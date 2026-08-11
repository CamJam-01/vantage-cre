-- CSV imports routinely carry property-type labels outside our curated five and
-- numeric cells (Sale Price, Acreage) that don't parse cleanly. Rather than reject
-- the whole row, the app now stores best-effort values and leaves the rest null.
-- The property_type enum check no longer reflects reality, so drop it (column
-- stays required text — just not restricted to a fixed list). acreage/sale_price
-- become nullable; their >=0/>0 CHECK constraints still apply whenever a value
-- IS present (a CHECK evaluates to true when its expression is NULL).

alter table public.land_sales drop constraint land_sales_property_type_check;

alter table public.land_sales alter column acreage drop not null;
alter table public.land_sales alter column sale_price drop not null;
