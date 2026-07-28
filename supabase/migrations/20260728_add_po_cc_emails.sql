-- Add cc_emails column to purchase_orders for email CC recipients on issued PO emails.
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS cc_emails text[] DEFAULT '{}';
