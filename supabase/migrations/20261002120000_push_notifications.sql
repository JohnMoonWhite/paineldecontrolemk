-- Push notifications to admins' devices for new system payments and manual ledger entries.

-- 1. Web Push (VAPID) keys, created by the send-push function on its first run. Only the
--    service role reads this table; admins get the public key through get_push_public_key().
create table public.monitoring_push_config (
  id smallint primary key default 1 check (id = 1),
  vapid_public text not null,
  vapid_private text not null,
  created_at timestamptz not null default now()
);

alter table public.monitoring_push_config enable row level security;
revoke all on table public.monitoring_push_config from anon, authenticated;

create or replace function public.get_push_public_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select vapid_public from public.monitoring_push_config
  where (select private.is_monitoring_admin());
$$;

revoke all on function public.get_push_public_key() from public, anon;
grant execute on function public.get_push_public_key() to authenticated;

-- 2. Devices that accepted notifications.
create table public.monitoring_push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.monitoring_push_subscriptions enable row level security;
revoke all on table public.monitoring_push_subscriptions from anon, authenticated;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_monitoring_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.monitoring_push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
  set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.monitoring_push_subscriptions
  where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function public.save_push_subscription(text, text, text) from public, anon;
revoke all on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;

-- 3. Notifications waiting to be pushed (and their history).
create table public.monitoring_notifications (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('payment', 'ledger', 'test')),
  title text not null,
  body text not null,
  url text not null default '/#cash',
  target_user uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index monitoring_notifications_pending_idx on public.monitoring_notifications (id) where sent_at is null;

alter table public.monitoring_notifications enable row level security;
revoke all on table public.monitoring_notifications from anon, authenticated;
grant select on table public.monitoring_notifications to authenticated;

create policy "monitoring admins can read notifications"
on public.monitoring_notifications for select to authenticated
using ((select private.is_monitoring_admin()));

create or replace function private.format_brl(p_cents bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || replace(replace(replace(to_char(p_cents / 100.0, 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.');
$$;

-- Any new notification wakes the send-push function right away.
create or replace function private.dispatch_push_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'monitoring_scheduler_key';
  if v_key is not null then
    perform net.http_post(
      url := 'https://egagpdfcyazjuzeofbbl.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_key),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  end if;
  return null;
end;
$$;

create trigger monitoring_notifications_dispatch
after insert on public.monitoring_notifications
for each statement execute function private.dispatch_push_notifications();

-- 4. Manual entries notify everyone.
create or replace function private.notify_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.monitoring_notifications (kind, title, body)
  values (
    'ledger',
    case when new.kind = 'income' then 'Nova entrada lançada' else 'Nova saída lançada' end,
    private.format_brl(new.amount_cents) || ' · ' || new.description
  );
  return new;
end;
$$;

create trigger monitoring_ledger_entries_notify
after insert on public.monitoring_ledger_entries
for each row execute function private.notify_ledger_entry();

-- 5. The payments replacement now announces payments it had not seen before.
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
  v_source_name text;
  v_written integer;
begin
  if jsonb_typeof(p_payments) <> 'array' then
    raise exception 'p_payments must be a JSON array';
  end if;

  select id, name into v_source_id, v_source_name from public.monitoring_sources where code = p_source_code;
  if v_source_id is null then
    raise exception 'unknown monitoring source: %', p_source_code;
  end if;

  create temporary table incoming_payments on commit drop as
  select payment.reference, payment.external_id, payment.entity_kind, payment.method, payment.paid_at, payment.amount_cents
  from jsonb_to_recordset(p_payments) as payment (
    reference text,
    external_id text,
    entity_kind text,
    method text,
    paid_at timestamptz,
    amount_cents bigint
  );

  insert into public.monitoring_notifications (kind, title, body)
  select
    'payment',
    'Novo pagamento recebido',
    private.format_brl(incoming.amount_cents) || ' · ' || coalesce(nullif(trim(fact.display_name), ''), 'Cliente')
      || ' · ' || case incoming.method when 'pix' then 'PIX' when 'stripe' then 'Cartão' else incoming.method end
      || ' · ' || v_source_name
  from incoming_payments incoming
  left join public.monitoring_subscription_facts fact
    on fact.is_current and fact.source_id = v_source_id
    and fact.external_id = incoming.external_id and fact.entity_kind = incoming.entity_kind
  where not exists (
      select 1 from public.monitoring_payments known
      where known.source_id = v_source_id and known.reference = incoming.reference
    )
    and not exists (
      select 1 from public.monitoring_finance_exclusions excluded
      where excluded.source_id = v_source_id and excluded.external_id = incoming.external_id
        and excluded.entity_kind = incoming.entity_kind
    )
    -- A source seen for the first time would announce its whole history.
    and exists (select 1 from public.monitoring_payments any_known where any_known.source_id = v_source_id);

  delete from public.monitoring_payments where source_id = v_source_id;

  insert into public.monitoring_payments (source_id, reference, external_id, entity_kind, method, paid_at, amount_cents)
  select v_source_id, reference, external_id, entity_kind, method, paid_at, amount_cents
  from incoming_payments
  on conflict (source_id, reference) do nothing;

  get diagnostics v_written = row_count;
  return v_written;
end;
$$;

-- 6. Lets an admin check that their device receives notifications.
create or replace function public.request_test_notification()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_monitoring_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.monitoring_notifications (kind, title, body, target_user)
  values ('test', 'Notificações ativadas', 'Você vai receber os novos pagamentos e lançamentos do caixa.', auth.uid());
end;
$$;

revoke all on function public.request_test_notification() from public, anon;
grant execute on function public.request_test_notification() to authenticated;
