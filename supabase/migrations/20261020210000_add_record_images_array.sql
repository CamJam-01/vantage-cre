-- Why: appraisers attach multiple photos per comp, each with its own caption.
-- Replaces the single-path / single-caption carve-outs with one jsonb array.
-- Legacy columns are copied when present and left in place (non-destructive).

alter table public.land_sales
  add column if not exists _record_images jsonb not null default '[]'::jsonb;

alter table public.improved_sales
  add column if not exists _record_images jsonb not null default '[]'::jsonb;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'land_sales' and column_name = '_record_image_path'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'land_sales' and column_name = '_record_image_caption'
  ) then
    update public.land_sales
    set _record_images = jsonb_build_array(
      jsonb_build_object(
        'path', _record_image_path,
        'caption', coalesce(nullif(trim(coalesce(_record_image_caption, '')), ''), '')
      )
    )
    where _record_image_path is not null
      and trim(_record_image_path) <> ''
      and (_record_images is null or _record_images = '[]'::jsonb);
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'land_sales' and column_name = '_record_image_path'
  ) then
    update public.land_sales
    set _record_images = jsonb_build_array(
      jsonb_build_object('path', _record_image_path, 'caption', '')
    )
    where _record_image_path is not null
      and trim(_record_image_path) <> ''
      and (_record_images is null or _record_images = '[]'::jsonb);
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'improved_sales' and column_name = '_record_image_path'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'improved_sales' and column_name = '_record_image_caption'
  ) then
    update public.improved_sales
    set _record_images = jsonb_build_array(
      jsonb_build_object(
        'path', _record_image_path,
        'caption', coalesce(nullif(trim(coalesce(_record_image_caption, '')), ''), '')
      )
    )
    where _record_image_path is not null
      and trim(_record_image_path) <> ''
      and (_record_images is null or _record_images = '[]'::jsonb);
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'improved_sales' and column_name = '_record_image_path'
  ) then
    update public.improved_sales
    set _record_images = jsonb_build_array(
      jsonb_build_object('path', _record_image_path, 'caption', '')
    )
    where _record_image_path is not null
      and trim(_record_image_path) <> ''
      and (_record_images is null or _record_images = '[]'::jsonb);
  end if;
end $$;

notify pgrst, 'reload schema';
