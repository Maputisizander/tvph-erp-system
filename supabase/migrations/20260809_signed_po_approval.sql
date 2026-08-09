alter table po_signatures
  add column if not exists signed_file_url text,
  add column if not exists signed_file_name text;

-- The transient 'out for signature' status was renamed from 'signed' to
-- 'pending_signature'; allow it in the status check constraint.
alter table public.purchase_orders
  drop constraint if exists purchase_orders_status_check;

alter table public.purchase_orders
  add constraint purchase_orders_status_check
  check (status = any (array[
    'draft', 'pending_approval', 'pending_finance', 'issued',
    'pending_signature', 'signed', 'partially_paid', 'paid', 'overpaid', 'cancelled'
  ]));

alter table purchase_orders
  add column if not exists signed_doc_status text,
  add column if not exists signed_doc_approved_by uuid,
  add column if not exists signed_doc_approved_at timestamptz,
  add column if not exists signed_doc_rejection_reason text;

update purchase_orders set status = 'pending_signature' where status = 'signed';
