-- Adds real Admin/Editor/Viewer roles (replacing the "any signed-in user can do
-- anything" model), account suspension, and an audit log for admin-visible
-- activity — per the new Profile / Database Manager designs.

alter table public.users add column role text not null default 'Viewer' check (role in ('Admin','Editor','Viewer'));
alter table public.users add column is_suspended boolean not null default false;
alter table public.users add column username text;

-- Grandfather existing accounts to Admin: before this migration every signed-in
-- user had unrestricted access, so this avoids locking anyone out. New signups
-- get the safer 'Viewer' default and must be promoted by an Admin.
update public.users set role = 'Admin';

-- Self-service profile updates (username/full_name only) stay a plain RLS
-- policy; role/is_suspended are deliberately NOT grantable via direct table
-- UPDATE at all — the only way to change them is through the SECURITY DEFINER
-- RPCs below, which check the caller is an Admin before writing.
drop policy if exists "authenticated users can update users" on public.users;
revoke update on public.users from authenticated;
grant update (username, full_name) on public.users to authenticated;
create policy "users can update own profile" on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.current_user_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.current_user_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(not is_suspended, true) from public.users where id = auth.uid();
$$;

create or replace function public.admin_set_user_role(target_id uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_user_role() is distinct from 'Admin' then
    raise exception 'Only admins can change user roles';
  end if;
  if new_role not in ('Admin','Editor','Viewer') then
    raise exception 'Invalid role: %', new_role;
  end if;
  update public.users set role = new_role where id = target_id;
end;
$$;

create or replace function public.admin_set_user_suspended(target_id uuid, suspended boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_user_role() is distinct from 'Admin' then
    raise exception 'Only admins can suspend or reactivate users';
  end if;
  if target_id = auth.uid() then
    raise exception 'You cannot change your own suspension status';
  end if;
  update public.users set is_suspended = suspended where id = target_id;
end;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default; these must
-- only ever run as the calling user, so lock that back down before granting
-- to authenticated specifically.
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.current_user_active() from public, anon;
revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
revoke all on function public.admin_set_user_suspended(uuid, boolean) from public, anon;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_active() to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
grant execute on function public.admin_set_user_suspended(uuid, boolean) to authenticated;

-- land_sales: Viewer = read-only, Editor/Admin = read+write, Admin = delete.
-- Suspended accounts lose read access entirely.
drop policy if exists "authenticated can read land_sales" on public.land_sales;
drop policy if exists "authenticated can insert land_sales" on public.land_sales;
drop policy if exists "authenticated can update land_sales" on public.land_sales;
drop policy if exists "authenticated can delete land_sales" on public.land_sales;

create policy "active users can read land_sales" on public.land_sales for select to authenticated
  using (public.current_user_active());
create policy "editors can insert land_sales" on public.land_sales for insert to authenticated
  with check (public.current_user_active() and public.current_user_role() in ('Editor','Admin'));
create policy "editors can update land_sales" on public.land_sales for update to authenticated
  using (public.current_user_active() and public.current_user_role() in ('Editor','Admin'))
  with check (public.current_user_active() and public.current_user_role() in ('Editor','Admin'));
create policy "admins can delete land_sales" on public.land_sales for delete to authenticated
  using (public.current_user_active() and public.current_user_role() = 'Admin');

-- Audit log — written by server actions after a successful action, read by
-- the admin-only Database Manager > Audit Log tab.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_name text not null default '',
  action text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
create policy "admins can read audit_log" on public.audit_log for select to authenticated
  using (public.current_user_role() = 'Admin');
create policy "authenticated can insert own audit_log" on public.audit_log for insert to authenticated
  with check (actor_id = auth.uid());
grant select, insert on public.audit_log to authenticated;
