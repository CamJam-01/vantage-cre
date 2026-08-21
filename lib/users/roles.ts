import type { SupabaseClient } from '@supabase/supabase-js';

export const ROLES = ['Admin', 'Editor', 'Viewer'] as const;
export type Role = (typeof ROLES)[number];

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  username: string | null;
  role: Role;
  is_suspended: boolean;
  avatar_url: string | null;
};

export const USER_PROFILE_SELECT =
  'id, email, full_name, username, role, is_suspended, avatar_url';
export const USER_PROFILE_SELECT_WITHOUT_AVATAR =
  'id, email, full_name, username, role, is_suspended';

function isMissingColumnError(message: string | undefined, column: string): boolean {
  return Boolean(message && message.includes(column) && /does not exist/i.test(message));
}

function asUserProfile(row: Omit<UserProfile, 'avatar_url'> & { avatar_url?: string | null }): UserProfile {
  return { ...row, avatar_url: row.avatar_url ?? null };
}

async function selectProfiles<T>(
  supabase: SupabaseClient,
  run: (columns: string) => PromiseLike<{ data: T | null; error: { message?: string } | null }>,
): Promise<T | null> {
  const primary = await run(USER_PROFILE_SELECT);
  if (!primary.error) return primary.data;

  if (isMissingColumnError(primary.error.message, 'avatar_url')) {
    const fallback = await run(USER_PROFILE_SELECT_WITHOUT_AVATAR);
    return fallback.data;
  }

  return null;
}

/** True for roles allowed to create/edit land sale records (manual entry or
 * CSV import) — Viewers are read-only. Deleting is Admin-only, checked separately. */
export function canEdit(role: Role): boolean {
  return role === 'Admin' || role === 'Editor';
}

/** Server-action gate: returns an error message when the caller must not
 * write `land_sales`. UI checks are not enough — actions are callable directly. */
export async function landSaleWriteDeniedMessage(supabase: SupabaseClient): Promise<string | null> {
  const profile = await getCurrentUserProfile(supabase);
  if (!profile || profile.is_suspended || !canEdit(profile.role)) {
    return 'You do not have permission to edit records.';
  }
  return null;
}

/** Fetches the signed-in user's own profile row, or null if there's no
 * session. Relies on the `public.users` RLS policy that lets a user read
 * their own row (and everyone's, per the current "using (true)" select policy).
 * If `avatar_url` has not been migrated yet, falls back to the older columns
 * so a missing photo column cannot look like a missing session. */
export async function getCurrentUserProfile(supabase: SupabaseClient): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const data = await selectProfiles(supabase, (columns) =>
    supabase.from('users').select(columns).eq('id', user.id).maybeSingle(),
  );
  if (!data) return null;
  return asUserProfile(data as UserProfile);
}

/** Loads every user row for admin access management. Same avatar_url fallback
 * as getCurrentUserProfile so a pending migration cannot empty the table. */
export async function listUserProfiles(supabase: SupabaseClient): Promise<UserProfile[]> {
  const data = await selectProfiles(supabase, (columns) =>
    supabase.from('users').select(columns).order('created_at'),
  );
  return ((data as Array<Omit<UserProfile, 'avatar_url'> & { avatar_url?: string | null }> | null) ?? [])
    .map(asUserProfile);
}
