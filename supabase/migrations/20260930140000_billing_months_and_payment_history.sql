-- 1. amount_cents is the value charged per billing cycle; billing_months is the cycle length
--    (12 for an annual plan). The dashboard counts amount_cents / billing_months per month.
-- 2. Each subscription fact also carries how the customer pays and their payment history,
--    so the dashboard can tell current subscribers from former ones.

alter table public.monitoring_manual_amounts
  add column if not exists billing_months smallint not null default 1
    check (billing_months between 1 and 36);

alter table public.monitoring_subscription_facts
  add column if not exists payment_method text,
  add column if not exists payments_count integer not null default 0 check (payments_count >= 0),
  add column if not exists first_paid_at timestamptz,
  add column if not exists last_paid_at timestamptz;

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
    payment_method,
    payments_count,
    first_paid_at,
    last_paid_at,
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
    fact.payment_method,
    coalesce(fact.payments_count, 0),
    fact.first_paid_at,
    fact.last_paid_at,
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
    provider text,
    payment_method text,
    payments_count integer,
    first_paid_at timestamptz,
    last_paid_at timestamptz
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
    payment_method = excluded.payment_method,
    payments_count = excluded.payments_count,
    first_paid_at = excluded.first_paid_at,
    last_paid_at = excluded.last_paid_at,
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

-- SAMUEL DOURADO paid R$ 497,00 for a year; the source records no value for it.
insert into public.monitoring_manual_amounts (source_id, external_id, entity_kind, amount_cents, billing_months, note)
select id, 'fa6c3cd7-de99-45f4-8291-19846b74ad8d', 'individual', 49700, 12, 'SAMUEL DOURADO: plano anual de R$ 497,00 informado pela equipe'
from public.monitoring_sources
where code = 'ordersync'
on conflict (source_id, entity_kind, external_id) do update
set amount_cents = excluded.amount_cents, billing_months = excluded.billing_months, note = excluded.note, updated_at = now();
