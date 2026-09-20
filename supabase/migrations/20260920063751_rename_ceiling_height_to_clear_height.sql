-- CoStar renamed CSV column DA from "Ceiling Height" to "Clear Height".
-- The catalog, land_sales column, import template, and export header are the
-- same string, so the live column and every stored field-name reference must
-- move together. Guarded so a database created from the updated creating
-- migration (already "Clear Height") is a no-op.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'land_sales'
      and column_name = 'Ceiling Height'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'land_sales'
      and column_name = 'Clear Height'
  ) then
    alter table public.land_sales rename column "Ceiling Height" to "Clear Height";
  end if;
end $$;

update public.result_display_settings
set hidden_field_keys = array_replace(hidden_field_keys, 'Ceiling Height', 'Clear Height'),
    field_order = array_replace(field_order, 'Ceiling Height', 'Clear Height')
where 'Ceiling Height' = any(hidden_field_keys)
   or 'Ceiling Height' = any(field_order);

update public.docx_output_flow_rules
set field_name = 'Clear Height'
where field_name = 'Ceiling Height';

notify pgrst, 'reload schema';
