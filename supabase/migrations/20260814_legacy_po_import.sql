-- ============================================================================
-- Legacy (pre-ERP) PO import
--   Imported POs are final/issued (skipping approval + signature), and their
--   uploaded PDF is stored as the PO's issued_pdf artifact. Mark them with
--   source='legacy' so the UI badges them and hides approval/email actions.
-- ============================================================================

-- 1. Source marker on POs.
alter table public.purchase_orders
  add column if not exists source text not null default 'erp'
  check (source = any (array['erp', 'legacy']));

-- 2. Legacy POs belong to pre-ERP projects, so they are never linked to an
--    ERP project (project_id stays null). Keep the name as free text.
alter table public.purchase_orders
  add column if not exists legacy_project text;

-- 3. Legacy numbers use the same PO-YYYYNNNNNN format as the ERP generator.
--    Bump the shared po_number_seq so a future ERP PO can never regenerate an
--    imported number (unique constraint on po_number). SECURITY DEFINER so the
--    authenticated caller can advance the sequence.
create or replace function public.ensure_po_sequence(min_seq bigint)
returns void
language sql
security definer
set search_path = public
as $$
  select setval('public.po_number_seq', greatest(min_seq, (select last_value from public.po_number_seq)))
$$;

revoke all on function public.ensure_po_sequence(bigint) from public;
grant execute on function public.ensure_po_sequence(bigint) to authenticated;
