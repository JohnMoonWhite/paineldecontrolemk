-- Monthly values informed by the team for subscriptions whose source records no value.
-- A value recorded by the source always takes precedence in the dashboard.

create table public.monitoring_manual_amounts (
  source_id uuid not null references public.monitoring_sources (id) on delete cascade,
  external_id text not null,
  entity_kind text not null check (entity_kind in ('individual', 'organization')),
  amount_cents bigint not null check (amount_cents > 0),
  note text,
  updated_at timestamptz not null default now(),
  primary key (source_id, entity_kind, external_id)
);

alter table public.monitoring_manual_amounts enable row level security;
revoke all on table public.monitoring_manual_amounts from anon, authenticated;
grant select on table public.monitoring_manual_amounts to authenticated;

create policy "monitoring admins can read manual amounts"
on public.monitoring_manual_amounts for select to authenticated
using ((select private.is_monitoring_admin()));

insert into public.monitoring_manual_amounts (source_id, external_id, entity_kind, amount_cents, note)
select id, '91b41a19-4ab9-4363-8630-86c5d7f7546f', 'organization', 23900, 'AGRODII: R$ 239,00/mês informado pela equipe'
from public.monitoring_sources
where code = 'ordersync'
on conflict (source_id, entity_kind, external_id) do update
set amount_cents = excluded.amount_cents, note = excluded.note, updated_at = now();
