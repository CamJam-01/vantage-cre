-- Named .docx merge templates backing Database Manager → Land Sales → "Set
-- templates" and the results page's "Merge to DOCX" action.
--
-- The row holds the name and points at a private storage object keyed by the
-- row id, so renaming never moves a file. Admins manage templates; every
-- active user may read them, because merging is a normal results-page action.

create table if not exists public.docx_templates (
  id uuid primary key default gen_random_uuid(),
  database_key text not null default 'sales',
  name text not null,
  storage_path text not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One name per database, case-insensitively: the merge dialog lists templates
-- by name alone, so two "Narrative" templates would be indistinguishable.
create unique index if not exists docx_templates_name_unique
  on public.docx_templates (database_key, lower(name));

alter table public.docx_templates enable row level security;

drop policy if exists "active users can read docx_templates" on public.docx_templates;
create policy "active users can read docx_templates" on public.docx_templates
  for select to authenticated
  using (public.current_user_active());

drop policy if exists "admins can insert docx_templates" on public.docx_templates;
create policy "admins can insert docx_templates" on public.docx_templates
  for insert to authenticated
  with check (public.current_user_active() and public.current_user_role() = 'Admin');

drop policy if exists "admins can update docx_templates" on public.docx_templates;
create policy "admins can update docx_templates" on public.docx_templates
  for update to authenticated
  using (public.current_user_active() and public.current_user_role() = 'Admin')
  with check (public.current_user_active() and public.current_user_role() = 'Admin');

drop policy if exists "admins can delete docx_templates" on public.docx_templates;
create policy "admins can delete docx_templates" on public.docx_templates
  for delete to authenticated
  using (public.current_user_active() and public.current_user_role() = 'Admin');

grant select, insert, update, delete on public.docx_templates to authenticated;

-- Private bucket: template files are only ever read server-side, by the merge
-- route handler acting as the signed-in user.
--
-- This bucket already exists on the deployed project (created alongside
-- comp-images in an earlier phase) and restricts allowed_mime_types to the
-- .docx type alone — which is why uploadTemplateAction passes contentType
-- explicitly rather than letting the browser's guess through. The insert below
-- is for environments that do not have it yet; an existing bucket keeps its
-- current settings.
insert into storage.buckets (id, name, public)
values ('docx-templates', 'docx-templates', false)
on conflict (id) do nothing;

drop policy if exists "active users can read docx template files" on storage.objects;
create policy "active users can read docx template files" on storage.objects
  for select to authenticated
  using (bucket_id = 'docx-templates' and public.current_user_active());

drop policy if exists "admins can upload docx template files" on storage.objects;
create policy "admins can upload docx template files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'docx-templates'
    and public.current_user_active()
    and public.current_user_role() = 'Admin'
  );

drop policy if exists "admins can replace docx template files" on storage.objects;
create policy "admins can replace docx template files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'docx-templates'
    and public.current_user_active()
    and public.current_user_role() = 'Admin'
  )
  with check (
    bucket_id = 'docx-templates'
    and public.current_user_active()
    and public.current_user_role() = 'Admin'
  );

drop policy if exists "admins can delete docx template files" on storage.objects;
create policy "admins can delete docx template files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'docx-templates'
    and public.current_user_active()
    and public.current_user_role() = 'Admin'
  );

notify pgrst, 'reload schema';
