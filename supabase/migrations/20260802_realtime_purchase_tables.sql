-- Publish PO/PR changes to realtime so open list pages can refresh live
-- (approval submissions, approvals, rejections). Idempotent: alter publication
-- errors on already-published tables, so guard with pg_publication_tables.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'purchase_orders'
  ) then
    alter publication supabase_realtime add table public.purchase_orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'purchase_requests'
  ) then
    alter publication supabase_realtime add table public.purchase_requests;
  end if;
end $$;
