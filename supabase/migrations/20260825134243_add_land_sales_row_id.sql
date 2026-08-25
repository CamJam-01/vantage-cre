-- Unique row identity for view/edit routing. CoStar Comp ID is not unique
-- (many imported rows share 0 / null), so maybeSingle() on Comp ID fails.

alter table public.land_sales
  add column if not exists id uuid not null default gen_random_uuid();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'land_sales_id_pkey'
      and conrelid = 'public.land_sales'::regclass
  ) then
    alter table public.land_sales
      add constraint land_sales_id_pkey primary key (id);
  end if;
end $$;

notify pgrst, 'reload schema';
