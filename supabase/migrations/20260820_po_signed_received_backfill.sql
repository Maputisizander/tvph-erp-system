-- POs signed through the old portal flow (before the signed_received feature)
-- kept status 'pending_signature' while a signed doc awaited review. Move them
-- to 'signed_received' so the UI/filters show the signed copy is in.
update public.purchase_orders
set status = 'signed_received', updated_at = now()
where status = 'pending_signature'
  and signed_doc_status = 'pending_approval'
  and signed_at is not null;