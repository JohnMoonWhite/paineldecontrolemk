begin;

select plan(5);

select has_table('public', 'monitoring_sources', 'monitoring sources exist');

set local role anon;
select throws_ok(
  $$select * from public.monitoring_sources$$,
  '42501',
  null,
  'anonymous users cannot read monitoring sources'
);

reset role;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'monitoring-admin@example.test',
  '$2a$10$7EqJtq98hPqEX7fNZaFWoOa3hxlXC4AitBbV6It6j1lQ72aCQRbrK',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
);

insert into public.monitoring_admins (user_id, display_name)
values ('11111111-1111-1111-1111-111111111111', 'Partner');

insert into public.monitoring_sources (code, name)
values ('ordersync', 'OrdemSync');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","aal":"aal1","role":"authenticated"}';
select is_empty(
  $$select code from public.monitoring_sources where code = 'ordersync'$$,
  'allow-listed users at AAL1 cannot read monitoring sources'
);

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","aal":"aal2","role":"authenticated"}';
select results_eq(
  $$select code from public.monitoring_sources where code = 'ordersync'$$,
  array['ordersync'],
  'allow-listed users at AAL2 can read monitoring sources'
);

rollback;
