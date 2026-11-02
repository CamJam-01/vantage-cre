'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/users/roles';
import { logAudit } from '@/lib/audit/log';
import { resultColumns } from '@/lib/land-sales/result-columns';
import type { FieldDivider } from '@/lib/land-sales/field-visibility';
import { parseVisibilitySubmission } from '@/lib/admin/field-visibility-action';
import { salesPathFromDatabaseKey } from '@/lib/land-sales/sales-path';
import { loadDisplaySettings } from '@/lib/land-sales/display-settings';
import { validateSearchFilterSelection } from '@/lib/land-sales/filter-visibility';

export type FieldVisibilityActionState =
  | {
      status: 'success';
      message: string;
      hiddenFieldIds: string[];
      fieldOrder: string[];
      fieldDividers: FieldDivider[];
      recordImagePlacement: 'tab' | 'above';
    }
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

  const path = salesPathFromDatabaseKey(formData.get('database_key'));
  const columns = resultColumns({ pathId: path?.id });
  const submission = parseVisibilitySubmission(formData, columns);
  if (!submission.ok) return { status: 'error', message: submission.message };

  const { error } = await supabase
    .from('result_display_settings')
    .upsert({
      database_key: submission.databaseKey,
      hidden_field_keys: submission.hiddenFieldIds,
      field_order: submission.fieldOrder,
      field_dividers: submission.fieldDividers,
      record_image_placement: submission.recordImagePlacement,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    }, { onConflict: 'database_key' });
  if (error) return { status: 'error', message: `Could not save field visibility: ${error.message}` };

  const visibleCount = columns.length - submission.hiddenFieldIds.length;
  await logAudit(
    supabase,
    'Updated Field Visibility',
    `${path?.label ?? 'Sales'}: ${visibleCount} of ${columns.length} fields visible, ${submission.fieldDividers.length} pages and field groups`,
  );

  revalidatePath('/admin/database-manager/fields');
  if (path) {
    revalidatePath(path.basePath);
    revalidatePath(path.searchPath);
    revalidatePath(`${path.basePath}/new`);
    revalidatePath(`${path.basePath}/[id]`, 'page');
  }

  return {
    status: 'success',
    message: 'Field display settings saved for all users.',
    hiddenFieldIds: submission.hiddenFieldIds,
    fieldOrder: submission.fieldOrder,
    fieldDividers: submission.fieldDividers,
    recordImagePlacement: submission.recordImagePlacement,
  };
}

export type SearchFilterVisibilityActionState =
  | { status: 'success'; message: string; hiddenFilterIds: string[] }
  | { status: 'error'; message: string }
  | null;

export async function saveSearchFilterVisibilityAction(
  _previousState: SearchFilterVisibilityActionState,
  formData: FormData,
): Promise<SearchFilterVisibilityActionState> {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile || profile.is_suspended || profile.role !== 'Admin') {
    return { status: 'error', message: 'Only active Admin users can change search filters.' };
  }

  const path = salesPathFromDatabaseKey(formData.get('database_key'));
  if (!path) return { status: 'error', message: 'This table is not available for search filter settings.' };

  try {
    const display = await loadDisplaySettings(supabase, path.databaseKey);
    const columns = resultColumns({ pathId: path.id });
    const selection = validateSearchFilterSelection(
      formData.getAll('visible_filter_id'), columns, display.hidden, display.hiddenFilters,
    );
    if (!selection.ok) return { status: 'error', message: selection.message };

    // Update only filter preferences; column visibility/order and every record
    // remain untouched, including when settings are saved from another form.
    const { error } = await supabase.from('result_display_settings').upsert({
      database_key: path.databaseKey,
      hidden_filter_keys: selection.hiddenFilterIds,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    }, { onConflict: 'database_key' });
    if (error) return { status: 'error', message: `Could not save search filters: ${error.message}` };

    await logAudit(supabase, 'Updated Search Filters', `${path.label}: search filter visibility updated`);
    revalidatePath('/admin/database-manager/fields');
    revalidatePath(path.searchPath);
    revalidatePath(path.basePath);
    revalidatePath(`${path.basePath}/[id]`, 'page');
    return {
      status: 'success',
      message: 'Search filters saved for all users of this table.',
      hiddenFilterIds: selection.hiddenFilterIds,
    };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Could not save search filters.' };
  }
}
