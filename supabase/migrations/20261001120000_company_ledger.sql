-- Company-wide cash summary: payments received by the monitored systems plus manual entries.

-- 1. Payments the sources actually received, replaced in full on every collection.
create table public.monitoring_payments (
  source_id uuid not null references public.monitoring_sources (id) on delete cascade,
  reference text not null,
  external_id text not null,
  entity_kind text not null check (entity_kind in ('individual', 'organization')),
  method text not null,
  paid_at timestamptz not null,
  amount_cents bigint not null check (amount_cents >= 0),
  primary key (source_id, reference)
);

create index monitoring_payments_paid_at_idx on public.monitoring_payments (paid_at);

alter table public.monitoring_payments enable row level security;
revoke all on table public.monitoring_payments from anon, authenticated;
grant select on table public.monitoring_payments to authenticated;

create policy "monitoring admins can read payments"
on public.monitoring_payments for select to authenticated
using ((select private.is_monitoring_admin()));

create or replace function public.replace_monitoring_payments(
  p_source_code text,
  p_payments jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_written integer;
begin
  if jsonb_typeof(p_payments) <> 'array' then
    raise exception 'p_payments must be a JSON array';
  end if;

  select id into v_source_id from public.monitoring_sources where code = p_source_code;
  if v_source_id is null then
    raise exception 'unknown monitoring source: %', p_source_code;
  end if;

  delete from public.monitoring_payments where source_id = v_source_id;

  insert into public.monitoring_payments (source_id, reference, external_id, entity_kind, method, paid_at, amount_cents)
  select v_source_id, payment.reference, payment.external_id, payment.entity_kind, payment.method, payment.paid_at, payment.amount_cents
  from jsonb_to_recordset(p_payments) as payment (
    reference text,
    external_id text,
    entity_kind text,
    method text,
    paid_at timestamptz,
    amount_cents bigint
  )
  on conflict (source_id, reference) do nothing;

  get diagnostics v_written = row_count;
  return v_written;
end;
$$;

revoke all on function public.replace_monitoring_payments(text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_monitoring_payments(text, jsonb) to service_role;

-- 2. Manual entries (income and expenses) recorded by the team in the dashboard.
create table public.monitoring_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income', 'expense')),
  amount_cents bigint not null check (amount_cents > 0),
  entry_date date not null,
  description text not null check (length(trim(description)) > 0),
  category text,
  payment_method text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index monitoring_ledger_entries_date_idx on public.monitoring_ledger_entries (entry_date) where deleted_at is null;

alter table public.monitoring_ledger_entries enable row level security;
revoke all on table public.monitoring_ledger_entries from anon, authenticated;
grant select, insert, update on table public.monitoring_ledger_entries to authenticated;

create policy "monitoring admins can read ledger entries"
on public.monitoring_ledger_entries for select to authenticated
using ((select private.is_monitoring_admin()));

create policy "monitoring admins can add ledger entries"
on public.monitoring_ledger_entries for insert to authenticated
with check ((select private.is_monitoring_admin()));

-- Entries are removed by setting deleted_at, so history is never lost.
create policy "monitoring admins can change ledger entries"
on public.monitoring_ledger_entries for update to authenticated
using ((select private.is_monitoring_admin()))
with check ((select private.is_monitoring_admin()));
