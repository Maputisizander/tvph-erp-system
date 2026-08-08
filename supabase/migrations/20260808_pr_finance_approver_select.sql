-- Records which finance/superadmin users the PR originator selected to run
-- the finance budget check. NOTIFY-ONLY: it does not restrict who may approve
-- (any holder of the pr.approve_finance capability who isn't the admin-stage
-- approver can still approve). It drives the "pending finance" email sent to
-- the chosen finance approvers once the admin approves. Plain uuid[] (no FK —
-- Postgres arrays can't reference) and overwritten on each re-submit.
alter table public.purchase_requests
  add column if not exists finance_approval_requested_from uuid[] not null default '{}';