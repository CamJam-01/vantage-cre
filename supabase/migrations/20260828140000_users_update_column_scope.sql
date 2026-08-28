-- Why: RLS is row-level, not column-level. The `users can update own active
-- profile` policy only proves *which row* a caller may write, so an authenticated
-- session could PATCH its own row with role = 'Admin' via PostgREST and be
-- honoured by current_user_role() everywhere. Role and suspension are Admin
-- decisions and must travel only through the SECURITY DEFINER admin RPCs.
--
-- Two layers, because either alone is one mistake away from re-opening the hole:
--   1. Column-level UPDATE grants — the caller cannot even name role/is_suspended.
--   2. A trigger, so a future `grant update on public.users` cannot silently
--      restore self-escalation.

revoke update on public.users from authenticated;
grant update (username, avatar_url) on public.users to authenticated;

create or replace function public.users_guard_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SECURITY DEFINER admin RPCs execute as the function owner; only requests
  -- arriving directly as the `authenticated` role are self-service writes.
  if current_user = 'authenticated' then
    if new.role is distinct from old.role then
      raise exception 'Role can only be changed by an Admin.';
    end if;
    if new.is_suspended is distinct from old.is_suspended then
      raise exception 'Suspension can only be changed by an Admin.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists users_guard_privilege_columns on public.users;
create trigger users_guard_privilege_columns
  before update on public.users
  for each row execute function public.users_guard_privilege_columns();

notify pgrst, 'reload schema';
