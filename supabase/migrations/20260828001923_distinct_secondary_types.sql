-- Why: the land search Secondary Type filter only needs the distinct non-empty
-- values. Selecting that column from every row transferred the whole table for
-- a handful of dropdown options. SECURITY DEFINER is required so the function
-- can aggregate without the client pulling every row; current_user_active()
-- keeps it from leaking those values to suspended or signed-out callers.

create or replace function public.distinct_secondary_types()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.current_user_active() then
    raise exception 'Not authorized.';
  end if;
  return coalesce(
    (
      select array_agg(value order by value)
      from (
        select distinct trim(both from "Secondary Type") as value
        from public.land_sales
        where "Secondary Type" is not null
          and trim(both from "Secondary Type") <> ''
      ) t
    ),
    '{}'::text[]
  );
end;
$$;

revoke all on function public.distinct_secondary_types() from public;
grant execute on function public.distinct_secondary_types() to authenticated;

notify pgrst, 'reload schema';
