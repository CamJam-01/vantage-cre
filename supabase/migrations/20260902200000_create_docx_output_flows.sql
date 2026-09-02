-- Admin-defined DOCX outputs route each selected record to a saved template.
-- Rules are normalized so every template reference is protected by a foreign
-- key and deleting a template cannot silently break an existing output flow.

create table if not exists public.docx_output_flows (
  id uuid primary key default gen_random_uuid(),
  database_key text not null default 'sales',
  name text not null check (char_length(btrim(name)) between 1 and 80),
  default_template_id uuid not null references public.docx_templates(id) on delete restrict,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists docx_output_flows_name_unique
  on public.docx_output_flows (database_key, lower(name));

create table if not exists public.docx_output_flow_rules (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.docx_output_flows(id) on delete cascade,
  position integer not null check (position >= 0),
  field_name text not null check (char_length(btrim(field_name)) > 0),
  operator text not null check (operator in ('contains', 'equals', 'does_not_equal')),
  test_value text not null check (char_length(btrim(test_value)) between 1 and 200),
  template_id uuid not null references public.docx_templates(id) on delete restrict,
  unique (flow_id, position)
);

alter table public.docx_output_flows enable row level security;
alter table public.docx_output_flow_rules enable row level security;

drop policy if exists "active users can read docx_output_flows" on public.docx_output_flows;
create policy "active users can read docx_output_flows" on public.docx_output_flows
  for select to authenticated
  using (public.current_user_active());

drop policy if exists "admins can insert docx_output_flows" on public.docx_output_flows;
create policy "admins can insert docx_output_flows" on public.docx_output_flows
  for insert to authenticated
  with check (public.current_user_active() and public.current_user_role() = 'Admin');

drop policy if exists "admins can update docx_output_flows" on public.docx_output_flows;
create policy "admins can update docx_output_flows" on public.docx_output_flows
  for update to authenticated
  using (public.current_user_active() and public.current_user_role() = 'Admin')
  with check (public.current_user_active() and public.current_user_role() = 'Admin');

drop policy if exists "admins can delete docx_output_flows" on public.docx_output_flows;
create policy "admins can delete docx_output_flows" on public.docx_output_flows
  for delete to authenticated
  using (public.current_user_active() and public.current_user_role() = 'Admin');

drop policy if exists "active users can read docx_output_flow_rules" on public.docx_output_flow_rules;
create policy "active users can read docx_output_flow_rules" on public.docx_output_flow_rules
  for select to authenticated
  using (public.current_user_active());

drop policy if exists "admins can insert docx_output_flow_rules" on public.docx_output_flow_rules;
create policy "admins can insert docx_output_flow_rules" on public.docx_output_flow_rules
  for insert to authenticated
  with check (public.current_user_active() and public.current_user_role() = 'Admin');

drop policy if exists "admins can update docx_output_flow_rules" on public.docx_output_flow_rules;
create policy "admins can update docx_output_flow_rules" on public.docx_output_flow_rules
  for update to authenticated
  using (public.current_user_active() and public.current_user_role() = 'Admin')
  with check (public.current_user_active() and public.current_user_role() = 'Admin');

drop policy if exists "admins can delete docx_output_flow_rules" on public.docx_output_flow_rules;
create policy "admins can delete docx_output_flow_rules" on public.docx_output_flow_rules
  for delete to authenticated
  using (public.current_user_active() and public.current_user_role() = 'Admin');

grant select, insert, update, delete on public.docx_output_flows to authenticated;
grant select, insert, update, delete on public.docx_output_flow_rules to authenticated;

-- Replacing an ordered rule set must be atomic. A failed rule may not leave a
-- previously working flow with half its configuration deleted.
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
begin
  if not public.current_user_active() or public.current_user_role() <> 'Admin' then
    raise exception 'Only active Admin users can manage output flows.';
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
        and table_name = 'land_sales'
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
