-- Distinct text values for Land search comboboxes. Column names are
-- catalog headers; only a fixed whitelist is accepted so an arbitrary
-- identifier cannot be interpolated into the dynamic query.

create or replace function public.distinct_catalog_values(p_table text, p_column text)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result text[];
begin
  if not public.current_user_active() then
    raise exception 'Not authorized.';
  end if;
  if p_table is distinct from 'land_sales' and p_table is distinct from 'improved_sales' then
    raise exception 'Invalid table.';
  end if;
  if p_column is distinct from 'Property City'
    and p_column is distinct from 'Property State'
    and p_column is distinct from 'Property County'
    and p_column is distinct from 'Market'
    and p_column is distinct from 'Submarket Name'
    and p_column is distinct from 'Property Type'
    and p_column is distinct from 'Secondary Type'
    and p_column is distinct from 'Sale Type'
    and p_column is distinct from 'Sale Status'
  then
    raise exception 'Invalid column.';
  end if;

  execute format(
    $q$
      select coalesce(
        (
          select array_agg(value order by value)
          from (
            select distinct trim(both from %I) as value
            from public.%I
            where %I is not null
              and trim(both from %I) <> ''
          ) t
        ),
        '{}'::text[]
      )
    $q$,
    p_column,
    p_table,
    p_column,
    p_column
  ) into result;
  return result;
end;
$$;

revoke all on function public.distinct_catalog_values(text, text) from public;
grant execute on function public.distinct_catalog_values(text, text) to authenticated;

notify pgrst, 'reload schema';
