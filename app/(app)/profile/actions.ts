'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/log';
import type { Role } from '@/lib/users/roles';
import {
  AVATAR_BUCKET,
  avatarFileErrorMessage,
  avatarObjectPath,
  avatarObjectsToRemove,
  validateAvatarFile,
} from '@/lib/users/avatar';

export type ProfileFormState = { error?: string; success?: boolean; avatarUrl?: string } | null;

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

export async function updateAvatarAction(formData: FormData): Promise<ProfileFormState> {
  const file = formData.get('avatar');
  if (!(file instanceof Blob) || file.size === 0) {
    return { error: 'Choose a photo to upload.' };
  }

  const invalid = validateAvatarFile(file);
  if (invalid) return { error: avatarFileErrorMessage(invalid) };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { data: profile } = await supabase
    .from('users')
    .select('avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  const path = avatarObjectPath(user.id, file.type, crypto.randomUUID());
  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return { error: uploadError.message };

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const { error } = await supabase
    .from('users')
    .update({ avatar_url: data.publicUrl })
    .eq('id', user.id);

  const stalePaths = avatarObjectsToRemove({
    previousUrl: profile?.avatar_url,
    userId: user.id,
    newPath: path,
    profileUpdated: !error,
  });
  if (stalePaths.length > 0) {
    await supabase.storage.from(AVATAR_BUCKET).remove(stalePaths);
  }

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  revalidatePath('/profile');
  return { success: true, avatarUrl: data.publicUrl };
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
