import type { SupabaseClient } from '@supabase/supabase-js';
import { activeUsernames } from '@/lib/users/usernames';

/** Read only the public profile names needed by the verification control. */
export async function loadActiveUsernames(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('users')
    .select('username, is_suspended')
    .eq('is_suspended', false)
    .not('username', 'is', null)
    .order('username');
  if (error) throw new Error(`Could not load username suggestions: ${error.message}`);
  return activeUsernames(data ?? []);
}
