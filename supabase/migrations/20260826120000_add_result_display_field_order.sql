-- Admin-defined display order for the global field configuration. Stores every
-- field-visibility identifier (visible and hidden alike) in the order Database
-- Manager shows them, so hiding a field and showing it again does not move it.
-- An empty array means "no order saved yet": consumers fall back to the CoStar
-- catalog order.

alter table public.result_display_settings
  add column if not exists field_order text[] not null default '{}'::text[];

notify pgrst, 'reload schema';
