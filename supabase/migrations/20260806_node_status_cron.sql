-- ============================================================================
-- Scheduled node-status sync (Pattern A): every 15 min via pg_cron + pg_net.
-- Mirrors the existing reminder jobs: requires vault secrets `app_base_url`
-- and `cron_secret`, otherwise the job no-ops. The Next.js route performs the
-- actual per-vendor polling against twinbackend.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_node_status_sync()
returns void language plpgsql security definer
set search_path = public, vault, net
as $$
declare
  base_url text;
  secret   text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into secret   from vault.decrypted_secrets where name = 'cron_secret';
  if base_url is null or secret is null then
    raise notice 'node-status sync skipped: vault secret missing';
    return;
  end if;
  perform net.http_post(
    url     := base_url || '/api/cron/node-status',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || secret),
    body    := '{}'::jsonb);
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'node-status-sync') then
    perform cron.unschedule('node-status-sync');
  end if;
  perform cron.schedule('node-status-sync', '*/15 * * * *',
    $cron$ select public.trigger_node_status_sync(); $cron$);
end;
$$;
