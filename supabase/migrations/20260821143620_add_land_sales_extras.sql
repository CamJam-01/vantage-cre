-- Custom fields from CSV import: values live in land_sales.extras (jsonb),
-- and labels are catalogued so Schema can list them without scanning rows.

alter table public.land_sales
  add column if not exists extras jsonb not null default '{}'::jsonb;

comment on column public.land_sales.extras is
  'Custom fields created during CSV import, keyed by the source column header.';

create table if not exists public.land_sales_custom_fields (
  label text primary key,
  created_at timestamptz not null default now()
);

alter table public.land_sales_custom_fields enable row level security;

drop policy if exists "active users can read land_sales_custom_fields" on public.land_sales_custom_fields;
create policy "active users can read land_sales_custom_fields"
  on public.land_sales_custom_fields for select to authenticated
  using (public.current_user_active());

drop policy if exists "editors can insert land_sales_custom_fields" on public.land_sales_custom_fields;
create policy "editors can insert land_sales_custom_fields"
  on public.land_sales_custom_fields for insert to authenticated
  with check (public.current_user_active() and public.current_user_role() in ('Editor','Admin'));

grant select, insert on public.land_sales_custom_fields to authenticated;
