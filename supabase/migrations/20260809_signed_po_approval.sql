alter table po_signatures
  add column if not exists signed_file_url text,
  add column if not exists signed_file_name text;

alter table purchase_orders
  add column if not exists signed_doc_status text,
  add column if not exists signed_doc_approved_by uuid,
  add column if not exists signed_doc_approved_at timestamptz,
  add column if not exists signed_doc_rejection_reason text;

update purchase_orders set status = 'pending_signature' where status = 'signed';
