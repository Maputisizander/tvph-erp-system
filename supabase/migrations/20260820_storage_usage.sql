-- ============================================================================
-- Superadmin System panel: per-bucket storage usage + configurable quota.
-- ============================================================================

-- Aggregate storage.objects per bucket. Security definer so the service-role
-- RPC works without pulling every object row into the app server.
create or replace function public.storage_usage()
returns table (bucket_id text, files bigint, bytes bigint)
language sql
security definer
set search_path = storage, public
as $$
  select b.id::text as bucket_id,
         count(o.id)::bigint as files,
         coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint as bytes
  from storage.buckets b
  left join storage.objects o on o.bucket_id = b.id
  group by b.id
  order by bytes desc;
$$;

revoke all on function public.storage_usage() from public;
grant execute on function public.storage_usage() to service_role;

-- Optional plan quota (bytes) shown as "used / available" on the System page.
alter table public.system_settings
  add column if not exists storage_quota_bytes bigint;