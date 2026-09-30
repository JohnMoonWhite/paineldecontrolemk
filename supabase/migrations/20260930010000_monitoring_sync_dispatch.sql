-- Dispatches source collections from the database so both the five-minute schedule and the
-- dashboard "Atualizar agora" button can run them without exposing the scheduler key.
-- Requires the Vault secret `monitoring_scheduler_key` (the `monitoring_scheduler` API key).

create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function private.dispatch_monitoring_syncs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_source record;
  v_dispatched integer := 0;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'monitoring_scheduler_key';

  if v_key is null then
    raise exception 'Vault secret monitoring_scheduler_key is missing';
  end if;

  -- Each source is collected by an Edge Function named sync-<code>.
  for v_source in select code from public.monitoring_sources order by code loop
    perform net.http_post(
      url := 'https://egagpdfcyazjuzeofbbl.supabase.co/functions/v1/sync-' || v_source.code,
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_key),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
    v_dispatched := v_dispatched + 1;
  end loop;

  return v_dispatched;
end;
$$;

revoke all on function private.dispatch_monitoring_syncs() from public, anon, authenticated, service_role;

create or replace function public.request_monitoring_sync()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent timestamptz;
begin
  if coalesce((select auth.jwt()) ->> 'aal', '') <> 'aal2'
    or not (select private.is_monitoring_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- A collection that started moments ago already answers this request.
  select max(started_at) into v_recent
  from public.monitoring_sync_runs
  where started_at > now() - interval '20 seconds';

  if v_recent is not null then
    return v_recent;
  end if;

  perform private.dispatch_monitoring_syncs();
  return now();
end;
$$;

revoke all on function public.request_monitoring_sync() from public, anon;
grant execute on function public.request_monitoring_sync() to authenticated;

select cron.schedule(
  'monitoring-sync-every-5-minutes',
  '*/5 * * * *',
  $$select private.dispatch_monitoring_syncs()$$
);
