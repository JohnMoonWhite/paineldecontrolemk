create schema if not exists private;

create table public.monitoring_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.monitoring_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'healthy'
    check (status in ('healthy', 'warning', 'stale', 'failed')),
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.monitoring_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.monitoring_sources (id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  facts_written integer not null default 0 check (facts_written >= 0),
  error_summary text
);

create index monitoring_sync_runs_source_started_idx
  on public.monitoring_sync_runs (source_id, started_at desc);

create table public.monitoring_subscription_facts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.monitoring_sources (id) on delete cascade,
  external_id text not null,
  entity_kind text not null check (entity_kind in ('individual', 'organization')),
  display_name text,
  plan text,
  status text not null,
  period_end_at timestamptz,
  trial_end_at timestamptz,
  cancel_at_period_end boolean,
  seat_count integer check (seat_count is null or seat_count >= 0),
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  currency text,
  provider text,
  observed_at timestamptz not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  unique (source_id, external_id, entity_kind, observed_at)
);

create index monitoring_subscription_facts_current_source_idx
  on public.monitoring_subscription_facts (source_id, observed_at desc)
  where is_current;

create table public.monitoring_alerts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.monitoring_sources (id) on delete cascade,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  code text not null,
  message text not null,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index monitoring_alerts_open_source_idx
  on public.monitoring_alerts (source_id, opened_at desc)
  where resolved_at is null;

alter table public.monitoring_admins enable row level security;
alter table public.monitoring_sources enable row level security;
alter table public.monitoring_sync_runs enable row level security;
alter table public.monitoring_subscription_facts enable row level security;
alter table public.monitoring_alerts enable row level security;

revoke all on table public.monitoring_admins,
  public.monitoring_sources,
  public.monitoring_sync_runs,
  public.monitoring_subscription_facts,
  public.monitoring_alerts
from anon, authenticated;

grant select on table public.monitoring_admins,
  public.monitoring_sources,
  public.monitoring_sync_runs,
  public.monitoring_subscription_facts,
  public.monitoring_alerts
to authenticated;

create or replace function private.is_monitoring_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.monitoring_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_monitoring_admin() from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.is_monitoring_admin() to authenticated;

create policy "monitoring admins can read their allow-list entry"
on public.monitoring_admins
for select
to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and user_id = (select auth.uid())
);

create policy "monitoring admins can read sources"
on public.monitoring_sources
for select
to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and (select private.is_monitoring_admin())
);

create policy "monitoring admins can read sync runs"
on public.monitoring_sync_runs
for select
to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and (select private.is_monitoring_admin())
);

create policy "monitoring admins can read subscription facts"
on public.monitoring_subscription_facts
for select
to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and (select private.is_monitoring_admin())
);

create policy "monitoring admins can read alerts"
on public.monitoring_alerts
for select
to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and (select private.is_monitoring_admin())
);

create or replace function public.replace_monitoring_snapshot(
  p_source_code text,
  p_observed_at timestamptz,
  p_facts jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_facts_written integer;
  v_run_id uuid;
begin
  if jsonb_typeof(p_facts) <> 'array' then
    raise exception 'p_facts must be a JSON array';
  end if;

  select id into v_source_id
  from public.monitoring_sources
  where code = p_source_code
  for update;

  if v_source_id is null then
    raise exception 'unknown monitoring source: %', p_source_code;
  end if;

  insert into public.monitoring_sync_runs (source_id, status)
  values (v_source_id, 'running')
  returning id into v_run_id;

  insert into public.monitoring_subscription_facts (
    source_id,
    external_id,
    entity_kind,
    display_name,
    plan,
    status,
    period_end_at,
    trial_end_at,
    cancel_at_period_end,
    seat_count,
    amount_cents,
    currency,
    provider,
    observed_at,
    is_current
  )
  select
    v_source_id,
    fact.external_id,
    fact.entity_kind,
    fact.display_name,
    fact.plan,
    fact.status,
    fact.period_end_at,
    fact.trial_end_at,
    fact.cancel_at_period_end,
    fact.seat_count,
    fact.amount_cents,
    fact.currency,
    fact.provider,
    p_observed_at,
    true
  from jsonb_to_recordset(p_facts) as fact (
    external_id text,
    entity_kind text,
    display_name text,
    plan text,
    status text,
    period_end_at timestamptz,
    trial_end_at timestamptz,
    cancel_at_period_end boolean,
    seat_count integer,
    amount_cents bigint,
    currency text,
    provider text
  )
  on conflict (source_id, external_id, entity_kind, observed_at)
  do update set
    display_name = excluded.display_name,
    plan = excluded.plan,
    status = excluded.status,
    period_end_at = excluded.period_end_at,
    trial_end_at = excluded.trial_end_at,
    cancel_at_period_end = excluded.cancel_at_period_end,
    seat_count = excluded.seat_count,
    amount_cents = excluded.amount_cents,
    currency = excluded.currency,
    provider = excluded.provider,
    is_current = true;

  get diagnostics v_facts_written = row_count;

  update public.monitoring_subscription_facts
  set is_current = false
  where source_id = v_source_id
    and is_current
    and observed_at <> p_observed_at;

  update public.monitoring_sources
  set
    status = 'healthy',
    last_attempt_at = now(),
    last_success_at = p_observed_at,
    last_error = null,
    updated_at = now()
  where id = v_source_id;

  update public.monitoring_sync_runs
  set
    status = 'succeeded',
    facts_written = v_facts_written,
    completed_at = now()
  where id = v_run_id;

  return v_facts_written;
exception
  when others then
    update public.monitoring_sync_runs
    set
      status = 'failed',
      error_summary = left(sqlerrm, 500),
      completed_at = now()
    where id = v_run_id;
    raise;
end;
$$;

create or replace function public.record_monitoring_sync_failure(
  p_source_code text,
  p_error_summary text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_is_stale boolean;
begin
  select id, last_success_at is null or last_success_at < now() - interval '15 minutes'
  into v_source_id, v_is_stale
  from public.monitoring_sources
  where code = p_source_code
  for update;

  if v_source_id is null then
    raise exception 'unknown monitoring source: %', p_source_code;
  end if;

  update public.monitoring_sources
  set
    status = case when v_is_stale then 'stale' else 'warning' end,
    last_attempt_at = now(),
    last_error = left(p_error_summary, 500),
    updated_at = now()
  where id = v_source_id;

  insert into public.monitoring_sync_runs (
    source_id,
    completed_at,
    status,
    error_summary
  )
  values (
    v_source_id,
    now(),
    'failed',
    left(p_error_summary, 500)
  );
end;
$$;

revoke all on function public.replace_monitoring_snapshot(text, timestamptz, jsonb)
  from public, anon, authenticated;
revoke all on function public.record_monitoring_sync_failure(text, text)
  from public, anon, authenticated;
grant execute on function public.replace_monitoring_snapshot(text, timestamptz, jsonb)
  to service_role;
grant execute on function public.record_monitoring_sync_failure(text, text)
  to service_role;

insert into public.monitoring_sources (code, name)
values ('ordersync', 'OrdemSync')
on conflict (code) do nothing;
