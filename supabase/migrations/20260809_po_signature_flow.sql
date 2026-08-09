-- PO e-signature flow.
--   A PO is issued through the existing two-stage flow (finance -> issued).
--   Procurement can then request a vendor e-signature: the PO moves to a
--   transient 'signed' state (out for signature), sent_at is stamped, and the
--   vendor is emailed a magic link. The vendor signs via /portal/po/[token];
--   a po_signatures row + signed_at are recorded and the PO returns to 'issued'.
--   Signature evidence never gates issuing or downstream payment logic.

-- 1. Transient 'signed' state + signature timestamps on POs.
alter table public.purchase_orders
  drop constraint if exists purchase_orders_status_check;

alter table public.purchase_orders
  add constraint purchase_orders_status_check
  check (status = any (array[
    'draft', 'pending_approval', 'pending_finance', 'issued',
    'signed', 'partially_paid', 'paid', 'overpaid', 'cancelled'
  ]));

alter table public.purchase_orders
  add column if not exists sent_at timestamptz,
  add column if not exists signed_at timestamptz;

-- 2. Signature evidence table. Mirrors po_completion_certificates RLS:
--    staff read/insert/update; service-role (portal) bypasses RLS.
create table if not exists public.po_signatures (
  id          uuid primary key default gen_random_uuid(),
  po_id       uuid not null references public.purchase_orders(id) on delete cascade,
  signer_name text not null,
  signer_title text,
  ip_address  text,
  signed_at   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table public.po_signatures enable row level security;
grant select, insert, update on public.po_signatures to authenticated;

drop policy if exists "staff can read po signatures" on public.po_signatures;
drop policy if exists "staff can insert po signatures" on public.po_signatures;
drop policy if exists "staff can update po signatures" on public.po_signatures;
create policy "staff can read po signatures" on public.po_signatures
  for select to authenticated using (public.is_staff((select auth.uid())));
create policy "staff can insert po signatures" on public.po_signatures
  for insert to authenticated with check (public.is_staff((select auth.uid())));
create policy "staff can update po signatures" on public.po_signatures
  for update to authenticated
  using (public.is_staff((select auth.uid())))
  with check (public.is_staff((select auth.uid())));

create index if not exists po_signatures_po_id_idx
  on public.po_signatures (po_id);

-- 3. Magic links: allow 'po' entity type for signature links.
alter table public.magic_links
  drop constraint if exists magic_links_entity_type_check;

alter table public.magic_links
  add constraint magic_links_entity_type_check
  check (entity_type = any (array['vendor', 'customer', 'po']));

-- 4. email_log kind for the signature-request template.
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind = any (array[
  'po_issued', 'po_pending_approval', 'doc_reminder', 'doc_request', 'invoice_due_reminder',
  'invoice_due_date', 'vendor_deadline_reminder', 'payment_request_notification',
  'pr_pending_approval', 'pr_approved', 'po_pending_finance', 'pr_pending_finance',
  'po_for_signature'
]));
