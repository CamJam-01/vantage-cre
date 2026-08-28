-- Why: an unrecognized Sale Date must survive import as original text so the
-- results table can flag the row for review and export can re-emit it.
-- `_sale_date_raw` is a system column, not a catalog field — it must never
-- appear in the header row, the template, the export, or the record UI.

alter table public.land_sales
  add column if not exists _sale_date_raw text;

notify pgrst, 'reload schema';
