-- Supabase's database linter flags extensions installed in `public`; pg_trgm was
-- created there by the prior migration's `create extension if not exists pg_trgm`.
alter extension pg_trgm set schema extensions;
