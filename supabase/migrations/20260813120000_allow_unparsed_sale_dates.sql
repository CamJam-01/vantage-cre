-- CSV imports must never be blocked by a sale date we can't interpret. When
-- parsing fails, the app now stores the row anyway with sale_date left null
-- and the original text preserved in sale_date_raw, so the UI can flag it for
-- review instead of rejecting the whole row.
alter table public.land_sales alter column sale_date drop not null;
alter table public.land_sales add column sale_date_raw text;

comment on column public.land_sales.sale_date_raw is
  'Original imported text for sale_date when it could not be parsed into a real date. Null for every normally-imported row.';
