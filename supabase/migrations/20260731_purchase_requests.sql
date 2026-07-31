-- Purchase Requests: the intake step before Purchase Orders.
-- Flow: draft -> pending_approval -> approved -> converted (PO created).
-- 1 PR converts to exactly 1 PO; the vendor is chosen at conversion time.

create table if not exists public.purchase_requests (
  id                uuid primary key default gen_random_uuid(),
  pr_number         text not null unique,
  description       text,
  amount            numeric not null, -- estimated total from line items
  currency          text not null default 'PHP' check (currency = any (array['PHP', 'USD'])),
  status            text not null default 'draft' check (status = any (array['draft', 'pending_approval', 'approved', 'rejected', 'converted', 'cancelled'])),
  project_id        uuid references public.projects(id),
  internal_entity_id uuid references public.internal_entities(id),
  created_by        uuid references public.profiles(id),
  submitted_for_approval_by uuid references auth.users(id),
  submitted_for_approval_at timestamptz,
  approval_requested_from uuid[],
  approved_by_user_id uuid,
  approved_at       timestamptz,
  rejection_reason  text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  deleted_at        timestamptz
);
alter table public.purchase_requests enable row level security;

create table if not exists public.pr_line_items (
  id          uuid primary key default gen_random_uuid(),
  pr_id       uuid not null references public.purchase_requests(id) on delete cascade,
  line_no     integer not null,
  item_code   text default '',
  description text not null default '',
  qty         numeric not null default 1,
  uom         text not null default 'LOT',
  unit_price  numeric not null default 0, -- estimated price
  amount      numeric not null default 0,
  created_at  timestamptz default now()
);
alter table public.pr_line_items enable row level security;

-- PO side of the link. NULL for legacy POs created before PRs existed.
-- The unique partial index is the guard against double-conversion (no
-- cross-statement transaction in the app layer, so the DB enforces 1:1).
alter table public.purchase_orders
  add column if not exists purchase_request_id uuid references public.purchase_requests(id);

create unique index if not exists purchase_orders_purchase_request_id_key
  on public.purchase_orders (purchase_request_id)
  where purchase_request_id is not null;

-- PR number auto-generation (sequence + function already exist from
-- 20260629_po_pr_number_format.sql) — just attach the trigger to the new table.
drop trigger if exists set_pr_number on public.purchase_requests;
create trigger set_pr_number
  before insert on public.purchase_requests
  for each row
  execute function public.generate_pr_number();

-- RLS: mirror the PO tables (20260603_rbac_and_magic_links.sql): the header
-- table is staff-only for writes so the 4-eyes approval can't be bypassed via
-- the client API; the line-items table is permissive like po_line_items.
drop policy if exists "pr_read_policy" on public.purchase_requests;
create policy "pr_read_policy" on public.purchase_requests
  for select to authenticated
  using (
    public.is_staff(auth.uid()) or
    public.is_pm_assigned_to_project(auth.uid(), project_id)
  );

drop policy if exists "pr_write_policy" on public.purchase_requests;
create policy "pr_write_policy" on public.purchase_requests
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

drop policy if exists "Allow authenticated full access" on public.pr_line_items;
create policy "Allow authenticated full access" on public.pr_line_items
  for all to authenticated using (true) with check (true);

-- Site details captured at the request stage so approvers see the scope and the
-- PO inherits it at conversion. Mirrors po_site_details 1:1.
create table if not exists public.pr_site_details (
  id          uuid primary key default gen_random_uuid(),
  pr_id       uuid not null references public.purchase_requests(id) on delete cascade,
  sn          integer not null,
  region      text not null default '',
  area_city   text not null default '',
  node_id     text not null default '',
  phase       text not null default '',
  no_of_nodes integer not null default 0,
  cable_length_km numeric not null default 0,
  created_at  timestamptz default now()
);
alter table public.pr_site_details enable row level security;

drop policy if exists "Allow authenticated full access" on public.pr_site_details;
create policy "Allow authenticated full access" on public.pr_site_details
  for all to authenticated using (true) with check (true);

create index if not exists idx_pr_site_details_pr_id on public.pr_site_details(pr_id);

-- email_log kinds for the PR flow. payment_request_notification is also added —
-- app code (lib/email/payment-request.ts) already uses it but no migration ever
-- added it to this constraint.
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind = any (array[
  'po_issued', 'po_pending_approval', 'doc_reminder', 'doc_request', 'invoice_due_reminder',
  'invoice_due_date', 'vendor_deadline_reminder', 'payment_request_notification',
  'pr_pending_approval', 'pr_approved'
]));
