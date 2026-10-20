-- Why: appraisers caption the optional record photo on create/edit. Like
-- `_record_image_path`, this is a system carve-out — never a CoStar catalog
-- field, never CSV import/export.

alter table public.land_sales
  add column if not exists _record_image_caption text;

alter table public.improved_sales
  add column if not exists _record_image_caption text;

notify pgrst, 'reload schema';
