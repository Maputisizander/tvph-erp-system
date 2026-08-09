-- Fix: the signed-PO approval migration (_po_signature_flow) renamed the
-- transient status to 'pending_signature' but never re-created the status
-- CHECK constraint, so writes to 'pending_signature' violate the constraint
-- and the signature-request action fails before updating status or emailing.

alter table public.purchase_orders
  drop constraint if exists purchase_orders_status_check;

alter table public.purchase_orders
  add constraint purchase_orders_status_check
  check (status = any (array[
    'draft', 'pending_approval', 'pending_finance', 'issued',
    'pending_signature', 'signed', 'partially_paid', 'paid', 'overpaid', 'cancelled'
  ]));