drop policy "monitoring admins can read their allow-list entry"
  on public.monitoring_admins;
drop policy "monitoring admins can read sources"
  on public.monitoring_sources;
drop policy "monitoring admins can read sync runs"
  on public.monitoring_sync_runs;
drop policy "monitoring admins can read subscription facts"
  on public.monitoring_subscription_facts;
drop policy "monitoring admins can read alerts"
  on public.monitoring_alerts;

create policy "monitoring admins can read their allow-list entry"
on public.monitoring_admins
for select
to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and user_id = (select auth.uid())
);

create policy "monitoring admins can read sources"
on public.monitoring_sources
for select
to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and (select private.is_monitoring_admin())
);

create policy "monitoring admins can read sync runs"
on public.monitoring_sync_runs
for select
to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and (select private.is_monitoring_admin())
);

create policy "monitoring admins can read subscription facts"
on public.monitoring_subscription_facts
for select
to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and (select private.is_monitoring_admin())
);

create policy "monitoring admins can read alerts"
on public.monitoring_alerts
for select
to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and (select private.is_monitoring_admin())
);
