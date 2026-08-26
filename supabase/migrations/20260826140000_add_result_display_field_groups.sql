-- Titled section breaks for the record screens. Each entry is
-- { "id": text, "label": text }; its position comes from field_order, which
-- carries a matching "group:<id>" token, so groups drag alongside fields.

alter table public.result_display_settings
  add column if not exists field_groups jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
