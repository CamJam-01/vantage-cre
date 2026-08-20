-- Adds a public profile photo URL on users and a dedicated Storage bucket.
-- Users may only upload/replace files in their own folder ({auth uid}/...).

alter table public.users add column if not exists avatar_url text;

grant update (username, full_name, avatar_url) on public.users to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;
drop policy if exists "Users can delete their own avatar" on storage.objects;
drop policy if exists "Users can read avatars" on storage.objects;

create policy "Users can upload their own avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
);

create policy "Users can update their own avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
);

create policy "Users can delete their own avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
);

create policy "Users can read avatars"
on storage.objects for select to authenticated
using (bucket_id = 'avatars');
