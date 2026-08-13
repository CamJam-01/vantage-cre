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
};

/** True for roles allowed to create/edit land sale records (manual entry or
 * CSV import) — Viewers are read-only. Deleting is Admin-only, checked separately. */
export function canEdit(role: Role): boolean {
  return role === 'Admin' || role === 'Editor';
}

/** Fetches the signed-in user's own profile row, or null if there's no
 * session. Relies on the `public.users` RLS policy that lets a user read
 * their own row (and everyone's, per the current "using (true)" select policy). */
export async function getCurrentUserProfile(supabase: SupabaseClient): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, username, role, is_suspended')
    .eq('id', user.id)
    .maybeSingle();
  return (data as UserProfile | null) ?? null;
}
