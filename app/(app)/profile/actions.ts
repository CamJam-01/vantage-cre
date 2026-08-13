'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/log';
import type { Role } from '@/lib/users/roles';

export type ProfileFormState = { error?: string; success?: boolean } | null;

export async function updateProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const username = String(formData.get('username') ?? '').trim();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { error } = await supabase
    .from('users')
    .update({ username: username || null })
    .eq('id', user.id);

  if (error) return { error: error.message };
  revalidatePath('/profile');
  return { success: true };
}

export type AdminActionResult = { error?: string } | null;

export async function adminSetRoleAction(userId: string, role: Role): Promise<AdminActionResult> {
  const supabase = await createClient();
  const { data: target } = await supabase.from('users').select('email, full_name').eq('id', userId).maybeSingle();
  const { error } = await supabase.rpc('admin_set_user_role', { target_id: userId, new_role: role });
  if (error) return { error: error.message };
  await logAudit(supabase, 'Changed User Role', `${target?.full_name || target?.email || userId} → ${role}`);
  revalidatePath('/profile');
  return null;
}

export async function adminSetSuspendedAction(userId: string, suspended: boolean): Promise<AdminActionResult> {
  const supabase = await createClient();
  const { data: target } = await supabase.from('users').select('email, full_name').eq('id', userId).maybeSingle();
  const { error } = await supabase.rpc('admin_set_user_suspended', { target_id: userId, suspended });
  if (error) return { error: error.message };
  await logAudit(supabase, suspended ? 'Suspended User' : 'Reactivated User', `${target?.full_name || target?.email || userId}`);
  revalidatePath('/profile');
  return null;
}
