-- Availability of the projects' sites and databases, checked every five minutes.

create table public.monitoring_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  kind text not null check (kind in ('site', 'api', 'database')),
  -- 'ok' expects a 2xx/3xx answer; 'reachable' accepts any answer below 500 (APIs that need a key).
  expectation text not null default 'ok' check (expectation in ('ok', 'reachable')),
  sort smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.monitoring_site_checks (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.monitoring_sites (id) on delete cascade,
  checked_at timestamptz not null default now(),
  state text not null check (state in ('online', 'slow', 'offline')),
  status_code integer,
  latency_ms integer,
  error text
);

create index monitoring_site_checks_site_time_idx on public.monitoring_site_checks (site_id, checked_at desc);

alter table public.monitoring_sites enable row level security;
alter table public.monitoring_site_checks enable row level security;
revoke all on table public.monitoring_sites, public.monitoring_site_checks from anon, authenticated;
grant select on table public.monitoring_sites, public.monitoring_site_checks to authenticated;

create policy "monitoring admins can read sites"
on public.monitoring_sites for select to authenticated
using ((select private.is_monitoring_admin()));

create policy "monitoring admins can read site checks"
on public.monitoring_site_checks for select to authenticated
using ((select private.is_monitoring_admin()));

insert into public.monitoring_sites (name, url, kind, expectation, sort) values
  ('OrdemSync', 'https://ordemsync.pages.dev', 'site', 'ok', 10),
  ('MKHUB Admin', 'https://mkhubadmin.pages.dev', 'site', 'ok', 20),
  ('ControlFast', 'https://www.controlfast.com.br', 'site', 'ok', 30),
  ('Painel MKHub', 'https://paineldecontrolemk.pages.dev', 'site', 'ok', 40),
  ('Banco MKHUB', 'https://egagpdfcyazjuzeofbbl.supabase.co/auth/v1/health', 'database', 'reachable', 50),
  ('Banco OrdemSync', 'https://qggkcflrmusfvjqsfhsf.supabase.co/auth/v1/health', 'database', 'reachable', 60),
  ('Banco PMS', 'https://yhmernrmvlhjjafxdrpt.supabase.co/auth/v1/health', 'database', 'reachable', 70);

-- Latest state, uptime and the recent latency trend of every active site, under the caller's RLS.
create view public.monitoring_site_health with (security_invoker = true) as
select
  site.id, site.name, site.url, site.kind, site.sort,
  latest.checked_at, latest.state, latest.status_code, latest.latency_ms,
  stats.uptime_24h, stats.uptime_30d, stats.avg_latency_24h,
  coalesce(trend.points, '[]'::jsonb) as trend
from public.monitoring_sites site
left join lateral (
  select checked_at, state, status_code, latency_ms
  from public.monitoring_site_checks check_row
  where check_row.site_id = site.id
  order by checked_at desc
  limit 1
) latest on true
left join lateral (
  select
    round(100.0 * count(*) filter (where state <> 'offline' and checked_at > now() - interval '24 hours')
      / nullif(count(*) filter (where checked_at > now() - interval '24 hours'), 0), 2) as uptime_24h,
    round(100.0 * count(*) filter (where state <> 'offline') / nullif(count(*), 0), 2) as uptime_30d,
    round(avg(latency_ms) filter (where state <> 'offline' and checked_at > now() - interval '24 hours'))::integer as avg_latency_24h
  from public.monitoring_site_checks check_row
  where check_row.site_id = site.id and checked_at > now() - interval '30 days'
) stats on true
left join lateral (
  select jsonb_agg(jsonb_build_array(latency_ms, state) order by checked_at) as points
  from (
    select checked_at, latency_ms, state
    from public.monitoring_site_checks check_row
    where check_row.site_id = site.id
    order by checked_at desc
    limit 48
  ) recent
) trend on true
where site.active;

grant select on public.monitoring_site_health to authenticated;

-- Site incidents are notified too.
alter table public.monitoring_notifications drop constraint monitoring_notifications_kind_check;
alter table public.monitoring_notifications add constraint monitoring_notifications_kind_check
  check (kind in ('payment', 'ledger', 'test', 'site'));

-- Stores one round of checks and notifies when a site goes down or comes back.
create or replace function public.record_site_checks(p_checks jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_written integer;
begin
  create temporary table incoming_checks on commit drop as
  select item.site_id, item.state, item.status_code, item.latency_ms, item.error, previous.state as previous_state
  from jsonb_to_recordset(p_checks) as item (site_id uuid, state text, status_code integer, latency_ms integer, error text)
  left join lateral (
    select state from public.monitoring_site_checks check_row
    where check_row.site_id = item.site_id
    order by checked_at desc
    limit 1
  ) previous on true;

  insert into public.monitoring_notifications (kind, title, body, url)
  select 'site',
    case when incoming.state = 'offline' then 'Fora do ar: ' || site.name else 'Voltou ao ar: ' || site.name end,
    case when incoming.state = 'offline'
      then coalesce('HTTP ' || incoming.status_code, incoming.error, 'Sem resposta') || ' · ' || site.url
      else 'Respondendo novamente em ' || coalesce(incoming.latency_ms || ' ms', 'tempo normal') end,
    '/#integridade'
  from incoming_checks incoming
  join public.monitoring_sites site on site.id = incoming.site_id
  where incoming.previous_state is not null
    and (incoming.state = 'offline') <> (incoming.previous_state = 'offline');

  insert into public.monitoring_site_checks (site_id, state, status_code, latency_ms, error)
  select site_id, state, status_code, latency_ms, left(error, 200) from incoming_checks;
  get diagnostics v_written = row_count;

  delete from public.monitoring_site_checks where checked_at < now() - interval '35 days';
  return v_written;
end;
$$;

revoke all on function public.record_site_checks(jsonb) from public, anon, authenticated;
grant execute on function public.record_site_checks(jsonb) to service_role;

create or replace function private.dispatch_site_checks()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'monitoring_scheduler_key';
  if v_key is null then
    raise exception 'Vault secret monitoring_scheduler_key is missing';
  end if;
  perform net.http_post(
    url := 'https://egagpdfcyazjuzeofbbl.supabase.co/functions/v1/check-sites',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function private.dispatch_site_checks() from public, anon, authenticated, service_role;

select cron.schedule('monitoring-site-checks-every-5-minutes', '*/5 * * * *', $$select private.dispatch_site_checks()$$);
