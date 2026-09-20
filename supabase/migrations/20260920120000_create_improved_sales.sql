-- Improved Sales is a second property-type path under Sales. Same CoStar
-- catalog as land_sales, wholly separate table. LIKE copies columns/defaults
-- without indexes or PK names, which are schema-global and would collide.

create table public.improved_sales (
  like public.land_sales including defaults including generated
);

alter table public.improved_sales
  add constraint improved_sales_id_pkey primary key (id);

create index improved_sales_sale_date_idx
  on public.improved_sales ("Sale Date" desc);

create index improved_sales_property_state_idx
  on public.improved_sales ("Property State");

create index improved_sales_secondary_type_idx
  on public.improved_sales ("Secondary Type");

alter table public.improved_sales enable row level security;

create policy "active users can read improved_sales" on public.improved_sales
  for select to authenticated
  using (public.current_user_active());
create policy "editors can insert improved_sales" on public.improved_sales
  for insert to authenticated
  with check (public.current_user_active() and public.current_user_role() in ('Editor','Admin'));
create policy "editors can update improved_sales" on public.improved_sales
  for update to authenticated
  using (public.current_user_active() and public.current_user_role() in ('Editor','Admin'))
  with check (public.current_user_active() and public.current_user_role() in ('Editor','Admin'));
create policy "admins can delete improved_sales" on public.improved_sales
  for delete to authenticated
  using (public.current_user_active() and public.current_user_role() = 'Admin');

grant select, insert, update, delete on public.improved_sales to authenticated;

create or replace function public.proposed_use_labels(public.improved_sales)
returns text[]
language sql
stable
set search_path = ''
as $$
  select public.split_proposed_uses($1."Proposed Use");
$$;

revoke all on function public.proposed_use_labels(public.improved_sales) from public;
grant execute on function public.proposed_use_labels(public.improved_sales) to authenticated;

-- Distinct-value RPCs take a whitelisted table name so Improved can reuse the
-- same PostgREST entry points. The zero-arg overloads stay as Land wrappers.

create or replace function public.distinct_secondary_types(p_table text)
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
  execute format(
    $q$
      select coalesce(
        (
          select array_agg(value order by value)
          from (
            select distinct trim(both from "Secondary Type") as value
            from public.%I
            where "Secondary Type" is not null
              and trim(both from "Secondary Type") <> ''
          ) t
        ),
        '{}'::text[]
      )
    $q$,
    p_table
  ) into result;
  return result;
end;
$$;

create or replace function public.distinct_secondary_types()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select public.distinct_secondary_types('land_sales');
$$;

create or replace function public.distinct_proposed_uses(p_table text)
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
  execute format(
    $q$
      select coalesce(
        (
          select array_agg(value order by value)
          from (
            select distinct label as value
            from public.%I,
              lateral unnest(public.split_proposed_uses("Proposed Use")) as label
          ) t
        ),
        '{}'::text[]
      )
    $q$,
    p_table
  ) into result;
  return result;
end;
$$;

create or replace function public.distinct_proposed_uses()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select public.distinct_proposed_uses('land_sales');
$$;

revoke all on function public.distinct_secondary_types(text) from public;
grant execute on function public.distinct_secondary_types(text) to authenticated;
revoke all on function public.distinct_secondary_types() from public;
grant execute on function public.distinct_secondary_types() to authenticated;

revoke all on function public.distinct_proposed_uses(text) from public;
grant execute on function public.distinct_proposed_uses(text) to authenticated;
revoke all on function public.distinct_proposed_uses() from public;
grant execute on function public.distinct_proposed_uses() to authenticated;

-- Output-flow field validation must check the table that belongs to the
-- arrangement being saved, not only land_sales.
create or replace function public.save_docx_output_flow(
  p_flow_id uuid,
  p_database_key text,
  p_name text,
  p_default_template_id uuid,
  p_conditions jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_flow_id uuid;
  v_table text;
begin
  if not public.current_user_active() or public.current_user_role() <> 'Admin' then
    raise exception 'Only active Admin users can manage output flows.';
  end if;

  v_table := case p_database_key
    when 'sales' then 'land_sales'
    when 'improved-sales' then 'improved_sales'
    else null
  end;
  if v_table is null then
    raise exception 'This database is not available.';
  end if;

  if p_conditions is null
    or jsonb_typeof(p_conditions) <> 'array'
    or jsonb_array_length(p_conditions) > 20
  then
    raise exception 'Output flow conditions are invalid.';
  end if;

  if not exists (
    select 1 from public.docx_templates
    where id = p_default_template_id and database_key = p_database_key
  ) then
    raise exception 'The default template is not available for this database.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_conditions) as entries(condition)
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table
        and column_name = condition->>'field'
        and column_name not in ('id', '_sale_date_raw')
    )
    or condition->>'operator' not in ('contains', 'equals', 'does_not_equal')
    or char_length(btrim(condition->>'value')) not between 1 and 200
    or not exists (
      select 1 from public.docx_templates
      where id = (condition->>'templateId')::uuid
        and database_key = p_database_key
    )
  ) then
    raise exception 'One or more output flow conditions are invalid.';
  end if;

  if p_flow_id is null then
    insert into public.docx_output_flows (
      database_key, name, default_template_id, created_by
    ) values (
      p_database_key, btrim(p_name), p_default_template_id, auth.uid()
    ) returning id into v_flow_id;
  else
    update public.docx_output_flows
    set name = btrim(p_name),
        default_template_id = p_default_template_id,
        updated_at = now()
    where id = p_flow_id and database_key = p_database_key
    returning id into v_flow_id;

    if v_flow_id is null then
      raise exception 'Output flow not found.';
    end if;
  end if;

  delete from public.docx_output_flow_rules where flow_id = v_flow_id;
  insert into public.docx_output_flow_rules (
    flow_id, position, field_name, operator, test_value, template_id
  )
  select
    v_flow_id,
    ordinal - 1,
    condition->>'field',
    condition->>'operator',
    btrim(condition->>'value'),
    (condition->>'templateId')::uuid
  from jsonb_array_elements(p_conditions) with ordinality as entries(condition, ordinal);

  return v_flow_id;
end;
$$;

grant execute on function public.save_docx_output_flow(uuid, text, text, uuid, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
