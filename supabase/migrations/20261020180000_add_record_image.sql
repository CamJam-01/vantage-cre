-- Why: appraisers attach one photo per comp for Print (DOCX embed). The path
-- is a system carve-out — never a CoStar catalog field, never CSV import/export.
-- UI lives on the record screen only; merge uses {{ record_image }}.

alter table public.land_sales
  add column if not exists _record_image_path text;

alter table public.improved_sales
  add column if not exists _record_image_path text;

-- Private bucket (may already exist live as `comp-images` from an earlier
-- phase). Image MIME allow-list; uploads must pass contentType explicitly.
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values (
  'comp-images',
  'comp-images',
  false,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  5242880
)
on conflict (id) do nothing;

drop policy if exists "active users can read comp images" on storage.objects;
create policy "active users can read comp images" on storage.objects
  for select to authenticated
  using (bucket_id = 'comp-images' and public.current_user_active());

drop policy if exists "editors can upload comp images" on storage.objects;
create policy "editors can upload comp images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comp-images'
    and public.current_user_active()
    and public.current_user_role() in ('Admin', 'Editor')
  );

drop policy if exists "editors can replace comp images" on storage.objects;
create policy "editors can replace comp images" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'comp-images'
    and public.current_user_active()
    and public.current_user_role() in ('Admin', 'Editor')
  )
  with check (
    bucket_id = 'comp-images'
    and public.current_user_active()
    and public.current_user_role() in ('Admin', 'Editor')
  );

drop policy if exists "editors can delete comp images" on storage.objects;
create policy "editors can delete comp images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'comp-images'
    and public.current_user_active()
    and public.current_user_role() in ('Admin', 'Editor')
  );

notify pgrst, 'reload schema';
