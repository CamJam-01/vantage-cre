-- Why: suspension must revoke writes regardless of role (README §2). The users
-- UPDATE policy previously allowed any signed-in user to change their own row,
-- and the admin RPCs checked Admin role but not current_user_active().

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and cmd = 'UPDATE'
  loop
    execute format('drop policy if exists %I on public.users', pol.policyname);
  end loop;
end $$;

create policy "users can update own active profile"
  on public.users
  for update
  to authenticated
  using (id = auth.uid() and public.current_user_active())
  with check (id = auth.uid() and public.current_user_active());

create or replace function public.admin_set_user_role(target_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_active() or public.current_user_role() is distinct from 'Admin' then
    raise exception 'Only active Admin users can change roles.';
  end if;
  if new_role not in ('Admin', 'Editor', 'Viewer') then
    raise exception 'Invalid role.';
  end if;
  update public.users set role = new_role where id = target_id;
  if not found then
    raise exception 'User not found.';
  end if;
end;
$$;

create or replace function public.admin_set_user_suspended(target_id uuid, suspended boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_active() or public.current_user_role() is distinct from 'Admin' then
    raise exception 'Only active Admin users can change suspension.';
  end if;
  if target_id = auth.uid() then
    raise exception 'You cannot suspend your own account.';
  end if;
  update public.users set is_suspended = suspended where id = target_id;
  if not found then
    raise exception 'User not found.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
