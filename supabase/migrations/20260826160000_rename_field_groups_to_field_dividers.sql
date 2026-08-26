-- Pages join groups as a second kind of break in the arrangement, so the one
-- list holds both. Each entry becomes { "id": text, "kind": "page" | "group",
-- "label": text }, positioned by a matching "<kind>:<id>" token in field_order.

alter table public.result_display_settings
  rename column field_groups to field_dividers;

-- Anything saved before this migration was a group.
update public.result_display_settings
set field_dividers = (
  select coalesce(
    jsonb_agg(case when entry ? 'kind' then entry else entry || '{"kind":"group"}'::jsonb end),
    '[]'::jsonb
  )
  from jsonb_array_elements(field_dividers) as entry
)
where jsonb_typeof(field_dividers) = 'array'
  and jsonb_array_length(field_dividers) > 0;

notify pgrst, 'reload schema';
