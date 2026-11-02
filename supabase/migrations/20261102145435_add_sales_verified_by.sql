-- Verification is an app annotation, not provider data. Keep a text snapshot
-- so profile changes never rewrite a comp; existing sales RLS governs writes.
alter table public.land_sales add column if not exists _verified_by text;
alter table public.improved_sales add column if not exists _verified_by text;

comment on column public.land_sales._verified_by is 'App-only Verified By text; excluded from CoStar CSV.';
comment on column public.improved_sales._verified_by is 'App-only Verified By text; excluded from CoStar CSV.';

notify pgrst, 'reload schema';
