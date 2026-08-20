-- Allow the new 'signed_received' status (vendor returned a signed PO, awaiting
-- internal review by the originator) in the purchase_orders status check.
alter table public.purchase_orders
  drop constraint if exists purchase_orders_status_check;

alter table public.purchase_orders
  add constraint purchase_orders_status_check
  check (status = any (array[
    'draft', 'pending_approval', 'pending_finance', 'issued',
    'pending_signature', 'signed_received', 'signed',
    'partially_paid', 'paid', 'overpaid', 'cancelled'
  ]));

-- Allow po_signed_received in email_log (lib/email/po-signed-received.ts).
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind = any (array[
  'po_issued', 'po_pending_approval', 'doc_reminder', 'doc_request', 'invoice_due_reminder',
  'invoice_due_date', 'vendor_deadline_reminder', 'payment_request_notification',
  'pr_pending_approval', 'pr_approved', 'po_pending_finance', 'pr_pending_finance',
  'po_for_signature', 'po_signed_acknowledged', 'po_signed_received'
]));