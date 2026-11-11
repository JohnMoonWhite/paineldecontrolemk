-- Keeps the database small on the 500 MB plan. Two things grew without limit:
--   * cron.job_run_details: pg_cron logs every run of every job forever (one job runs each minute);
--   * monitoring_subscription_facts: each five-minute collection stored a full snapshot and
--     kept all of them, while the dashboard only reads the current one.
-- A daily purge keeps three days of cron logs, the last snapshot of each day (enough for
-- day-by-day trends) and 60 days of collection runs.

create or replace function private.purge_monitoring_history()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from cron.job_run_details where end_time < now() - interval '3 days';

  with daily_last as (
    select source_id, max(observed_at) as observed_at
    from public.monitoring_subscription_facts
    group by source_id, (observed_at at time zone 'America/Sao_Paulo')::date
  )
  delete from public.monitoring_subscription_facts fact
  where not fact.is_current
    and not exists (
      select 1 from daily_last
      where daily_last.source_id = fact.source_id and daily_last.observed_at = fact.observed_at
    );

  delete from public.monitoring_sync_runs where started_at < now() - interval '60 days';
end;
$$;

revoke all on function private.purge_monitoring_history() from public, anon, authenticated, service_role;

select cron.schedule('monitoring-purge-history-daily', '30 6 * * *', $$select private.purge_monitoring_history()$$);
