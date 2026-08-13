import type { SupabaseClient } from '@supabase/supabase-js';

/** Records one row in audit_log, attributed to the calling user (RLS requires
 * actor_id = auth.uid(), so this can only ever log the caller's own actions).
 * Never throws — a logging failure shouldn't block the action it's describing. */
export async function logAudit(supabase: SupabaseClient, action: string, detail: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('users').select('full_name, email').eq('id', user.id).maybeSingle();
    const actorName = profile?.full_name || profile?.email || user.email || 'Unknown';
    await supabase.from('audit_log').insert({ actor_id: user.id, actor_name: actorName, action, detail });
  } catch {
    // best-effort only
  }
}
