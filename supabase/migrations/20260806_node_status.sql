-- ============================================================================
-- Node Status: twinbackend work-status sync
--   node_status        - latest snapshot per (vendor, node), optionally linked
--                        to an ERP project (auto-resolved or manually set)
--   vendor_sync_state  - per-vendor sync outcome; exists even when a vendor
--                        has zero nodes (e.g. "unmatched" name drift) so the
--                        404 reconciliation report has somewhere to live
--
-- RLS delegates to public.is_staff() (superadmin/admin/finance/operations).
-- Cron writes bypass RLS via the service-role client.
-- ============================================================================

create table if not exists public.node_status (
  id                  uuid primary key default gen_random_uuid(),
  vendor_id           uuid not null references public.vendors(id) on delete cascade,
  node_id             text not null,
  project_id          uuid references public.projects(id) on delete set null,
  site                text,
  status              text not null default 'pending' check (status = any (array['pending', 'in_progress', 'completed'])),
  date_start          timestamptz,
  due_date            timestamptz,
  date_finished       timestamptz,
  progress_percentage numeric,
  poles_collected     integer not null default 0,
  poles_total         integer not null default 0,
  last_synced_at      timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (vendor_id, node_id)
);

alter table public.node_status enable row level security;

create index if not exists node_status_project_id_idx on public.node_status (project_id);
create index if not exists node_status_vendor_id_idx on public.node_status (vendor_id);

drop policy if exists "node_status_read_policy" on public.node_status;
create policy "node_status_read_policy" on public.node_status
  for select to authenticated
  using (public.is_staff(auth.uid()));

drop policy if exists "node_status_write_policy" on public.node_status;
create policy "node_status_write_policy" on public.node_status
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create table if not exists public.vendor_sync_state (
  vendor_id      uuid primary key references public.vendors(id) on delete cascade,
  last_synced_at timestamptz,
  last_ok_at     timestamptz,
  last_error     text,
  last_status    text not null default 'pending' check (last_status = any (array['pending', 'ok', 'unmatched', 'failed'])),
  updated_at     timestamptz not null default now()
);

alter table public.vendor_sync_state enable row level security;

drop policy if exists "vendor_sync_state_read_policy" on public.vendor_sync_state;
create policy "vendor_sync_state_read_policy" on public.vendor_sync_state
  for select to authenticated
  using (public.is_staff(auth.uid()));

drop policy if exists "vendor_sync_state_write_policy" on public.vendor_sync_state;
create policy "vendor_sync_state_write_policy" on public.vendor_sync_state
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));
