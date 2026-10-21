-- Why: photo upload requires the private `comp-images` bucket. Column
-- migrations can succeed while this bucket is still missing (or was never
-- created), which surfaces as a failed Upload with no caption UI yet.

insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values (
  'comp-images',
  'comp-images',
  false,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  5242880
)
on conflict (id) do update
set
  public = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types,
  file_size_limit = excluded.file_size_limit;

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
