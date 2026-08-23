create table public.result_display_settings (
  database_key text primary key,
  hidden_field_keys text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.result_display_settings enable row level security;

revoke all on table public.result_display_settings from anon, authenticated;
grant select, insert, update, delete on table public.result_display_settings to authenticated;

create policy "active users can read result display settings"
  on public.result_display_settings for select to authenticated
  using (public.current_user_active());

create policy "admins can insert result display settings"
  on public.result_display_settings for insert to authenticated
  with check (public.current_user_active() and public.current_user_role() = 'Admin');

create policy "admins can update result display settings"
  on public.result_display_settings for update to authenticated
  using (public.current_user_active() and public.current_user_role() = 'Admin')
  with check (public.current_user_active() and public.current_user_role() = 'Admin');

create policy "admins can delete result display settings"
  on public.result_display_settings for delete to authenticated
  using (public.current_user_active() and public.current_user_role() = 'Admin');
