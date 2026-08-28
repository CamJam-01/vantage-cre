-- Why: live INSERT/DELETE policies on public.users were `true` for any
-- authenticated session. A Viewer could delete their profile row and insert a
-- replacement with role = 'Admin', which current_user_role() then honours.
-- Signup uses auth.signUp only; the profile row is created here, as Viewer.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role, is_suspended)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'Viewer',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Drop every INSERT and DELETE policy; the product never deletes users, and
-- inserts happen only via the trigger above (which bypasses RLS as definer).
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and cmd in ('INSERT', 'DELETE')
  loop
    execute format('drop policy if exists %I on public.users', pol.policyname);
  end loop;
end $$;

notify pgrst, 'reload schema';
