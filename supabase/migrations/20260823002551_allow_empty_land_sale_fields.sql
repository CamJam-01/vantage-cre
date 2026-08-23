-- Empty records and blank CSV rows are valid. Give the remaining required text
-- columns the same empty-string default as parcel_id / address / buyer so an
-- insert that omits them still succeeds. Numeric and date columns are already
-- nullable from earlier migrations.
alter table public.land_sales alter column city set default '';
alter table public.land_sales alter column county set default '';
alter table public.land_sales alter column state set default '';
alter table public.land_sales alter column property_type set default '';
