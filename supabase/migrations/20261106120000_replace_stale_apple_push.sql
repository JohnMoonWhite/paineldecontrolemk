-- Reinstalling the app on an iPhone creates a new push endpoint while the old one stays valid,
-- so the device received every notification twice. Activating on an Apple device now replaces
-- the same person's previous registration of that device type. Other push services keep one
-- row per device, because two computers can share an identical browser signature.

alter table public.monitoring_push_subscriptions add column user_agent text;

drop function public.save_push_subscription(text, text, text);

create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_monitoring_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_endpoint like 'https://web.push.apple.com/%' and p_user_agent is not null then
    delete from public.monitoring_push_subscriptions
    where user_id = auth.uid()
      and endpoint like 'https://web.push.apple.com/%'
      and endpoint <> p_endpoint
      -- Rows saved before this column existed have no signature to compare.
      and (user_agent = p_user_agent or user_agent is null);
  end if;

  insert into public.monitoring_push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
  set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
