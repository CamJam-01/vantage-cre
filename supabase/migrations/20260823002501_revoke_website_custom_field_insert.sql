-- Website roles must not create custom field catalog entries.
-- Table columns and catalog labels are managed in Supabase by project admins.

do $$
begin
  if to_regclass('public.land_sales_custom_fields') is null then
    return;
  end if;

  execute 'drop policy if exists "editors can insert land_sales_custom_fields" on public.land_sales_custom_fields';
  execute 'revoke insert on public.land_sales_custom_fields from authenticated';
end $$;
