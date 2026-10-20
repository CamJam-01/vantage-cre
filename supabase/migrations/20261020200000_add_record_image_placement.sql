-- Why: Admins choose whether the record photo sits in a Photos tab (default)
-- or above the record-details sheet. Presentation only — not a catalog field.

alter table public.result_display_settings
  add column if not exists record_image_placement text not null default 'tab';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'result_display_settings_record_image_placement_check'
  ) then
    alter table public.result_display_settings
      add constraint result_display_settings_record_image_placement_check
      check (record_image_placement in ('tab', 'above'));
  end if;
end $$;

notify pgrst, 'reload schema';
