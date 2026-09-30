-- The dashboard no longer requires MFA: monitoring data is readable by any signed-in
-- account on the monitoring_admins allow-list, at any assurance level.

drop policy "monitoring admins can read their allow-list entry" on public.monitoring_admins;
drop policy "monitoring admins can read sources" on public.monitoring_sources;
drop policy "monitoring admins can read sync runs" on public.monitoring_sync_runs;
drop policy "monitoring admins can read subscription facts" on public.monitoring_subscription_facts;
drop policy "monitoring admins can read alerts" on public.monitoring_alerts;

create policy "monitoring admins can read their allow-list entry"
on public.monitoring_admins for select to authenticated
using (user_id = (select auth.uid()));

create policy "monitoring admins can read sources"
on public.monitoring_sources for select to authenticated
using ((select private.is_monitoring_admin()));

create policy "monitoring admins can read sync runs"
on public.monitoring_sync_runs for select to authenticated
using ((select private.is_monitoring_admin()));

create policy "monitoring admins can read subscription facts"
on public.monitoring_subscription_facts for select to authenticated
using ((select private.is_monitoring_admin()));

create policy "monitoring admins can read alerts"
on public.monitoring_alerts for select to authenticated
using ((select private.is_monitoring_admin()));

create or replace function public.request_monitoring_sync()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent timestamptz;
begin
  if not (select private.is_monitoring_admin()) then
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

-- Internal accounts (admins, tests) that must not count as revenue.
create table public.monitoring_finance_exclusions (
  source_id uuid not null references public.monitoring_sources (id) on delete cascade,
  external_id text not null,
  entity_kind text not null check (entity_kind in ('individual', 'organization')),
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (source_id, entity_kind, external_id)
);

alter table public.monitoring_finance_exclusions enable row level security;
revoke all on table public.monitoring_finance_exclusions from anon, authenticated;
grant select on table public.monitoring_finance_exclusions to authenticated;

create policy "monitoring admins can read finance exclusions"
on public.monitoring_finance_exclusions for select to authenticated
using ((select private.is_monitoring_admin()));

insert into public.monitoring_finance_exclusions (source_id, external_id, entity_kind, reason)
select source.id, account.external_id, 'organization', account.reason
from public.monitoring_sources source
cross join (values
  ('cad3bd58-5dd7-4ce6-a18e-6133a6e77a67', 'MKHUB (conta interna)'),
  ('c6c934b9-e6de-42e9-8618-e619ea4be034', 'Clebson - GESTOR TESTE (conta de teste)')
) as account (external_id, reason)
where source.code = 'ordersync'
on conflict do nothing;
