begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_table('public', 'result_display_settings', 'settings table exists');
select col_is_pk('public', 'result_display_settings', 'database_key', 'database_key is the primary key');
select col_type_is('public', 'result_display_settings', 'hidden_field_keys', 'text[]', 'hidden keys use text[]');
select policies_are(
  'public',
  'result_display_settings',
  array[
    'active users can read result display settings',
    'admins can insert result display settings',
    'admins can update result display settings',
    'admins can delete result display settings'
  ],
  'all four policies are installed'
);
select table_privs_are(
  'public',
  'result_display_settings',
  'anon',
  array[]::text[],
  'anon has no table grants'
);
select table_privs_are(
  'public',
  'result_display_settings',
  'authenticated',
  array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'authenticated receives the required Data API grants'
);
select isnt_empty(
  $$
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'result_display_settings'
      and cmd = 'SELECT'
      and qual like '%current_user_active%'
  $$,
  'read policy requires an active user'
);
select isnt_empty(
  $$
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'result_display_settings'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and coalesce(qual, with_check, '') like '%Admin%'
  $$,
  'write policies require Admin'
);

select * from finish();
rollback;
