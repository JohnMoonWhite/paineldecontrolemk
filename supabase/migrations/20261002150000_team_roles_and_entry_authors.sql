-- Access levels for the dashboard team and the author of each manual entry.
--   owner: everything, including changing the team's access levels
--   editor: reads everything and records cash entries
--   viewer: reads everything, cannot record or remove entries

alter table public.monitoring_admins
  add column role text not null default 'editor' check (role in ('owner', 'editor', 'viewer'));

update public.monitoring_admins set role = 'owner';
update public.monitoring_admins set display_name = 'Matheus' where user_id = '2b44c81b-1687-4913-908f-a246c5996250' and display_name is null;
update public.monitoring_admins set display_name = 'Clebson' where user_id = 'c103e34e-329e-471f-bdbd-63101b5a5f50' and display_name is null;

create or replace function private.monitoring_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.monitoring_admins where user_id = (select auth.uid());
$$;

revoke all on function private.monitoring_role() from public, anon, service_role;
grant execute on function private.monitoring_role() to authenticated;

drop policy "monitoring admins can add ledger entries" on public.monitoring_ledger_entries;
drop policy "monitoring admins can change ledger entries" on public.monitoring_ledger_entries;

create policy "monitoring editors can add ledger entries"
on public.monitoring_ledger_entries for insert to authenticated
with check ((select private.monitoring_role()) in ('owner', 'editor'));

create policy "monitoring editors can change ledger entries"
on public.monitoring_ledger_entries for update to authenticated
using ((select private.monitoring_role()) in ('owner', 'editor'))
with check ((select private.monitoring_role()) in ('owner', 'editor'));

-- The author is stamped by the database, so it cannot be set from the browser.
alter table public.monitoring_ledger_entries add column author_name text;

create or replace function private.stamp_ledger_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_by := auth.uid();
  select coalesce(nullif(trim(admin.display_name), ''), split_part(person.email, '@', 1))
  into new.author_name
  from auth.users person
  left join public.monitoring_admins admin on admin.user_id = person.id
  where person.id = auth.uid();
  return new;
end;
$$;

create trigger monitoring_ledger_entries_author
before insert on public.monitoring_ledger_entries
for each row execute function private.stamp_ledger_author();

-- Notifications name who recorded the entry.
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
      || coalesce(' · por ' || new.author_name, '')
  );
  return new;
end;
$$;

create or replace function public.list_monitoring_team()
returns table (user_id uuid, name text, role text, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select admin.user_id,
    coalesce(nullif(trim(admin.display_name), ''), split_part(person.email, '@', 1)),
    admin.role,
    admin.user_id = (select auth.uid())
  from public.monitoring_admins admin
  join auth.users person on person.id = admin.user_id
  where (select private.is_monitoring_admin())
  order by admin.created_at;
$$;

create or replace function public.set_monitoring_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select private.monitoring_role()) is distinct from 'owner' then
    raise exception 'only owners can change access levels' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'editor', 'viewer') then
    raise exception 'unknown access level: %', p_role;
  end if;
  if p_role <> 'owner' and not exists (
    select 1 from public.monitoring_admins where role = 'owner' and user_id <> p_user_id
  ) then
    raise exception 'the team needs at least one owner';
  end if;

  update public.monitoring_admins set role = p_role where user_id = p_user_id;
end;
$$;

revoke all on function public.list_monitoring_team() from public, anon;
revoke all on function public.set_monitoring_role(uuid, text) from public, anon;
grant execute on function public.list_monitoring_team() to authenticated;
grant execute on function public.set_monitoring_role(uuid, text) to authenticated;
