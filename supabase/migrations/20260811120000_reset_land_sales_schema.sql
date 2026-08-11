-- Total reset of the workspaces / configurable-data-tables era schema, replaced by a
-- single-tenant land_sales table matching the new Vantage CRE design mockups.
-- public.users, its handle_new_user()/set_updated_at() triggers, and RLS pattern are
-- kept as-is (already the simple "any authenticated user" shape this rebuild wants).

drop table if exists public.data_row_images cascade;
drop table if exists public.docx_templates cascade;
drop table if exists public.saved_views cascade;
drop table if exists public.data_table_rows cascade;
drop table if exists public.data_table_fields cascade;
drop table if exists public.data_table_members cascade;
drop table if exists public.data_tables cascade;
drop table if exists public.workspace_invitations cascade;
drop table if exists public.workspace_members cascade;
drop table if exists public.workspaces cascade;
drop table if exists public.comp_data cascade;

drop function if exists public.set_comp_data_fingerprint() cascade;
drop schema if exists private cascade;

create extension if not exists pg_trgm;

create table public.land_sales (
  id              uuid primary key default gen_random_uuid(),
  parcel_id       text not null default '',
  address         text not null default '',
  city            text not null,
  county          text not null,
  state           text not null,
  msa             text,
  property_type   text not null check (property_type in ('Residential','Multifamily','Retail','Office','Industrial')),
  square_feet     numeric(14,2),
  acreage         numeric(12,4) not null check (acreage > 0),
  sale_date       date not null,
  sale_price      numeric(15,2) not null check (sale_price >= 0),
  price_per_acre  numeric(15,2) generated always as (case when acreage > 0 then round(sale_price / acreage, 2) end) stored,
  buyer           text not null default '',
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index land_sales_state_idx on public.land_sales (state);
create index land_sales_county_idx on public.land_sales (county);
create index land_sales_property_type_idx on public.land_sales (property_type);
create index land_sales_acreage_idx on public.land_sales (acreage);
create index land_sales_square_feet_idx on public.land_sales (square_feet);
create index land_sales_sale_date_idx on public.land_sales (sale_date desc);
create index land_sales_parcel_id_idx on public.land_sales (parcel_id);
create index land_sales_city_trgm_idx on public.land_sales using gin (city gin_trgm_ops);
create index land_sales_county_trgm_idx on public.land_sales using gin (county gin_trgm_ops);
create index land_sales_msa_trgm_idx on public.land_sales using gin (msa gin_trgm_ops);

create trigger land_sales_set_updated_at before update on public.land_sales
  for each row execute function public.set_updated_at();

alter table public.land_sales enable row level security;
create policy "authenticated can read land_sales" on public.land_sales for select to authenticated using (true);
create policy "authenticated can insert land_sales" on public.land_sales for insert to authenticated with check (true);
create policy "authenticated can update land_sales" on public.land_sales for update to authenticated using (true) with check (true);
create policy "authenticated can delete land_sales" on public.land_sales for delete to authenticated using (true);
grant select, insert, update, delete on public.land_sales to authenticated;
