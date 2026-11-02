-- Filter availability is presentation configuration independent of columns.
-- Default to all displayed columns; existing settings RLS restricts writes to active Admins.
alter table public.result_display_settings
  add column if not exists hidden_filter_keys text[] not null default '{}';

comment on column public.result_display_settings.hidden_filter_keys is
  'Per-table hidden search filters; hidden results columns are always unavailable for filtering.';

notify pgrst, 'reload schema';
