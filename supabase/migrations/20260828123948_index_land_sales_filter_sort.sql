-- Why: pagination repeats the same Sale Date sort and the two most common
-- filters on every results request. At row counts that hit the 8s statement
-- timeout these indexes keep the range query from becoming a sequential scan
-- of the full table.

create index if not exists land_sales_sale_date_idx
  on public.land_sales ("Sale Date" desc);

create index if not exists land_sales_property_state_idx
  on public.land_sales ("Property State");

create index if not exists land_sales_secondary_type_idx
  on public.land_sales ("Secondary Type");

notify pgrst, 'reload schema';
