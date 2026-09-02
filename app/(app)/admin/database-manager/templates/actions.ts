'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/users/roles';
import { logAudit } from '@/lib/audit/log';
import {
  DOCX_MIME_TYPE,
  DOCX_TEMPLATE_BUCKET,
  templateFileErrorMessage,
  templateNameError,
  templateObjectPath,
  validateTemplateFile,
} from '@/lib/land-sales/docx-templates';
import { SALES_DATABASE_KEY } from '@/lib/land-sales/field-visibility';
import {
  outputFlowDraftError,
  type OutputFlowDraft,
} from '@/lib/land-sales/output-flows';

export type TemplateActionState =
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }
  | null;

const DENIED = 'Only active Admin users can manage merge templates and Output Flows.';

/** Postgres unique-violation on docx_templates_name_unique. */
function duplicateNameMessage(message: string, name: string): string {
  return /duplicate key|unique constraint/i.test(message)
    ? `A template named “${name}” already exists.`
    : message;
}

function duplicateFlowNameMessage(message: string, name: string): string {
  return /duplicate key|unique constraint/i.test(message)
    ? `An Output Flow named “${name}” already exists.`
    : message;
}

async function requireAdmin() {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile || profile.is_suspended || profile.role !== 'Admin') return { supabase, profile: null };
  return { supabase, profile };
}

function refreshTemplateConsumers() {
  revalidatePath('/admin/database-manager/templates');
  revalidatePath('/land-sales');
}

export async function uploadTemplateAction(
  _previousState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const { supabase, profile } = await requireAdmin();
  if (!profile) return { status: 'error', message: DENIED };

  const name = String(formData.get('name') ?? '').trim();
  const nameError = templateNameError(name);
  if (nameError) return { status: 'error', message: nameError };

  const file = formData.get('template');
  if (!(file instanceof File)) return { status: 'error', message: templateFileErrorMessage('missing') };
  const fileProblem = validateTemplateFile(file);
  if (fileProblem) return { status: 'error', message: templateFileErrorMessage(fileProblem) };

  // The row is inserted first so the storage object can be keyed by its id;
  // if the upload then fails there is nothing pointing at a missing file.
  const { data: inserted, error: insertError } = await supabase
    .from('docx_templates')
    .insert({
      database_key: SALES_DATABASE_KEY,
      name,
      storage_path: 'pending',
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    const message = insertError?.message ?? 'Could not save the template.';
    return { status: 'error', message: duplicateNameMessage(message, name) };
  }

  const path = templateObjectPath(inserted.id as string);
  const { error: uploadError } = await supabase.storage
    .from(DOCX_TEMPLATE_BUCKET)
    .upload(path, file, { contentType: DOCX_MIME_TYPE, upsert: true });

  if (uploadError) {
    await supabase.from('docx_templates').delete().eq('id', inserted.id);
    return { status: 'error', message: `Could not upload the template: ${uploadError.message}` };
  }

  const { error: pathError } = await supabase
    .from('docx_templates')
    .update({ storage_path: path, updated_at: new Date().toISOString() })
    .eq('id', inserted.id);

  if (pathError) {
    await supabase.storage.from(DOCX_TEMPLATE_BUCKET).remove([path]);
    await supabase.from('docx_templates').delete().eq('id', inserted.id);
    return { status: 'error', message: `Could not save the template: ${pathError.message}` };
  }

  await logAudit(supabase, 'Added Merge Template', `Land Sales: ${name}`);
  refreshTemplateConsumers();
  return { status: 'success', message: `“${name}” is ready to use in Merge to DOCX.` };
}

export async function renameTemplateAction(id: string, name: string): Promise<TemplateActionState> {
  const { supabase, profile } = await requireAdmin();
  if (!profile) return { status: 'error', message: DENIED };

  const trimmed = name.trim();
  const nameError = templateNameError(trimmed);
  if (nameError) return { status: 'error', message: nameError };

  const { data: existing } = await supabase
    .from('docx_templates')
    .select('name')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('docx_templates')
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { status: 'error', message: duplicateNameMessage(error.message, trimmed) };

  await logAudit(
    supabase,
    'Renamed Merge Template',
    `Land Sales: ${existing?.name ?? id} → ${trimmed}`,
  );
  refreshTemplateConsumers();
  return { status: 'success', message: `Renamed to “${trimmed}”.` };
}

export async function deleteTemplateAction(id: string): Promise<TemplateActionState> {
  const { supabase, profile } = await requireAdmin();
  if (!profile) return { status: 'error', message: DENIED };

  const { data: existing } = await supabase
    .from('docx_templates')
    .select('name, storage_path')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('docx_templates').delete().eq('id', id);
  if (error) {
    const message = error.code === '23503'
      ? 'This template is used by an Output Flow. Change or delete that flow first.'
      : `Could not delete the template: ${error.message}`;
    return { status: 'error', message };
  }

  // Only after the row is gone — an orphaned file is harmless, a row pointing
  // at a deleted file breaks every merge that picks it.
  if (existing?.storage_path && existing.storage_path !== 'pending') {
    await supabase.storage.from(DOCX_TEMPLATE_BUCKET).remove([existing.storage_path]);
  }

  await logAudit(supabase, 'Deleted Merge Template', `Land Sales: ${existing?.name ?? id}`);
  refreshTemplateConsumers();
  return { status: 'success', message: `Deleted “${existing?.name ?? 'template'}”.` };
}

export async function saveOutputFlowAction(draft: OutputFlowDraft): Promise<TemplateActionState> {
  const { supabase, profile } = await requireAdmin();
  if (!profile) return { status: 'error', message: DENIED };

  const { data: templates, error: templateError } = await supabase
    .from('docx_templates')
    .select('id')
    .eq('database_key', SALES_DATABASE_KEY);
  if (templateError) {
    return { status: 'error', message: `Could not validate saved templates: ${templateError.message}` };
  }

  const templateIds = new Set((templates ?? []).map(template => String(template.id)));
  const validationError = outputFlowDraftError(draft, templateIds);
  if (validationError) return { status: 'error', message: validationError };

  const { error } = await supabase.rpc('save_docx_output_flow', {
    p_flow_id: draft.id,
    p_database_key: SALES_DATABASE_KEY,
    p_name: draft.name.trim(),
    p_default_template_id: draft.defaultTemplateId,
    p_conditions: draft.conditions,
  });
  if (error) {
    return {
      status: 'error',
      message: duplicateFlowNameMessage(error.message, draft.name.trim()),
    };
  }

  await logAudit(
    supabase,
    draft.id ? 'Updated DOCX Output Flow' : 'Added DOCX Output Flow',
    `Land Sales: ${draft.name.trim()}`,
  );
  refreshTemplateConsumers();
  return { status: 'success', message: `Saved output flow “${draft.name.trim()}”.` };
}

export async function deleteOutputFlowAction(id: string): Promise<TemplateActionState> {
  const { supabase, profile } = await requireAdmin();
  if (!profile) return { status: 'error', message: DENIED };

  const { data: existing } = await supabase
    .from('docx_output_flows')
    .select('name')
    .eq('id', id)
    .maybeSingle();
  const { error } = await supabase.from('docx_output_flows').delete().eq('id', id);
  if (error) return { status: 'error', message: `Could not delete the output flow: ${error.message}` };

  await logAudit(supabase, 'Deleted DOCX Output Flow', `Land Sales: ${existing?.name ?? id}`);
  refreshTemplateConsumers();
  return { status: 'success', message: `Deleted “${existing?.name ?? 'output flow'}”.` };
}
