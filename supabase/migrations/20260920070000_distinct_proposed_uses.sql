-- Why: Proposed Use cells often hold several comma-separated labels. The search
-- page needs the distinct tokens, not the combined strings, and the results
-- query must match a row when any selected token appears in that split array.
-- SECURITY DEFINER on the distinct RPC avoids transferring the column from
-- every row; current_user_active() keeps it from leaking to suspended or
-- signed-out callers. The table-argument computed field lets PostgREST overlap
-- against the split array without adding a storage column.

create or replace function public.split_proposed_uses(raw text)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    (
      select array_agg(label order by label)
      from (
        select distinct trim(both from part) as label
        from unnest(string_to_array(coalesce(raw, ''), ',')) as part
        where trim(both from part) <> ''
      ) t
    ),
    '{}'::text[]
  );
$$;

create or replace function public.distinct_proposed_uses()
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_active() then
    raise exception 'Not authorized.';
  end if;
  return coalesce(
    (
      select array_agg(value order by value)
      from (
        select distinct label as value
        from public.land_sales,
          lateral unnest(public.split_proposed_uses("Proposed Use")) as label
      ) t
    ),
    '{}'::text[]
  );
end;
$$;

create or replace function public.proposed_use_labels(public.land_sales)
returns text[]
language sql
stable
set search_path = ''
as $$
  select public.split_proposed_uses($1."Proposed Use");
$$;

revoke all on function public.split_proposed_uses(text) from public;
grant execute on function public.split_proposed_uses(text) to authenticated;

revoke all on function public.distinct_proposed_uses() from public;
grant execute on function public.distinct_proposed_uses() to authenticated;

revoke all on function public.proposed_use_labels(public.land_sales) from public;
grant execute on function public.proposed_use_labels(public.land_sales) to authenticated;

notify pgrst, 'reload schema';
