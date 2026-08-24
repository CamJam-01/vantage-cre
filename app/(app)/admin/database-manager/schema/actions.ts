'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/users/roles';
import { logAudit } from '@/lib/audit/log';
import { resultColumns } from '@/lib/land-sales/result-columns';
import { parseVisibilitySubmission } from '@/lib/admin/field-visibility-action';

export type FieldVisibilityActionState =
  | { status: 'success'; message: string; hiddenFieldIds: string[] }
  | { status: 'error'; message: string }
  | null;

export async function saveFieldVisibilityAction(
  _previousState: FieldVisibilityActionState,
  formData: FormData,
): Promise<FieldVisibilityActionState> {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile || profile.is_suspended || profile.role !== 'Admin') {
    return { status: 'error', message: 'Only active Admin users can change field visibility.' };
  }

  const catalogLabels: string[] = [];
  const columns = resultColumns({ catalogLabels });
  const submission = parseVisibilitySubmission(formData, columns);
  if (!submission.ok) return { status: 'error', message: submission.message };

  const { error } = await supabase
    .from('result_display_settings')
    .upsert({
      database_key: submission.databaseKey,
      hidden_field_keys: submission.hiddenFieldIds,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    }, { onConflict: 'database_key' });
  if (error) return { status: 'error', message: `Could not save field visibility: ${error.message}` };

  const visibleCount = columns.length - submission.hiddenFieldIds.length;
  await logAudit(
    supabase,
    'Updated Field Visibility',
    `Sales: ${visibleCount} of ${columns.length} fields visible`,
  );

  revalidatePath('/admin/database-manager/schema');
  revalidatePath('/land-sales');
  revalidatePath('/land-sales/[id]', 'page');

  return {
    status: 'success',
    message: 'Field visibility saved for all users.',
    hiddenFieldIds: submission.hiddenFieldIds,
  };
}
