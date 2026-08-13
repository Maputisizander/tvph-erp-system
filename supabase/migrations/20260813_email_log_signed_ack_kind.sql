-- Allow po_signed_acknowledged in email_log (lib/email/po-signed-acknowledged.ts).
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind = any (array[
  'po_issued', 'po_pending_approval', 'doc_reminder', 'doc_request', 'invoice_due_reminder',
  'invoice_due_date', 'vendor_deadline_reminder', 'payment_request_notification',
  'pr_pending_approval', 'pr_approved', 'po_pending_finance', 'pr_pending_finance',
  'po_for_signature', 'po_signed_acknowledged'
]));
