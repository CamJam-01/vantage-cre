'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/log';
import {
  extrasFromFormData,
  formDataHasExtras,
  landSaleInputSchema,
  type LandSale,
  type LandSaleInput,
} from '@/lib/land-sales/schema';
import {
  csvHeaders, looksLikeWrongDelimiter, parseCsv, recordKey, csvHeaderError,
  validateDataRows,
} from '@/lib/land-sales/csv';
import { landSaleWriteDeniedMessage } from '@/lib/users/roles';
import { resultColumns } from '@/lib/land-sales/result-columns';
import { loadHiddenFieldIds } from '@/lib/land-sales/display-settings';
import { SALES_DATABASE_KEY } from '@/lib/land-sales/field-visibility';
import { mergeVisibleUpdate, sanitizeVisibleCreate } from '@/lib/land-sales/visible-record-input';

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export type CreateFormState = { errors?: Record<string, string>; message?: string } | null;

export async function createLandSale(_prevState: CreateFormState, formData: FormData): Promise<CreateFormState> {
  const supabase = await createClient();
  const denied = await landSaleWriteDeniedMessage(supabase);
  if (denied) return { message: denied };

  const [customFields, settings] = await Promise.all([
    supabase.from('land_sales_custom_fields').select('label').order('label'),
    loadHiddenFieldIds(supabase, SALES_DATABASE_KEY)
      .then(hidden => ({ hidden, error: null }))
      .catch((error: unknown) => ({
        hidden: new Set<string>(),
        error: error instanceof Error ? error.message : 'Could not load field visibility.',
      })),
  ]);
  if (customFields.error) return { message: `Could not load the field catalog: ${customFields.error.message}` };
  if (settings.error) return { message: settings.error };

  const catalogLabels = (customFields.data ?? []).map(row => row.label as string);
  const extras = extrasFromFormData(formData);
  const raw = Object.fromEntries(formData.entries());
  const parsed = landSaleInputSchema.safeParse({ ...raw, extras });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] = issue.message;
    return { errors };
  }
  const sanitized = sanitizeVisibleCreate(
    parsed.data,
    catalogLabels,
    settings.hidden,
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('land_sales')
    .insert({ ...sanitized, created_by: user?.id ?? null })
    .select('id')
    .single();

  if (error) return { message: error.message };
  await logAudit(supabase, 'Created Record', `${sanitized.parcel_id || sanitized.address || data.id} added`);
  redirect(`/land-sales/${data.id}`);
}

/** Bound to the record id via `updateLandSale.bind(null, id)` when wired into
 * useActionState. Editing a visible date supersedes its raw import flag;
 * hiding the date preserves both stored date fields untouched. */
export async function updateLandSale(id: string, _prevState: CreateFormState, formData: FormData): Promise<CreateFormState> {
  const supabase = await createClient();
  const denied = await landSaleWriteDeniedMessage(supabase);
  if (denied) return { message: denied };

  const [existingResult, customFields, settings] = await Promise.all([
    supabase.from('land_sales').select('*').eq('id', id).maybeSingle(),
    supabase.from('land_sales_custom_fields').select('label').order('label'),
    loadHiddenFieldIds(supabase, SALES_DATABASE_KEY)
      .then(hidden => ({ hidden, error: null }))
      .catch((error: unknown) => ({
        hidden: new Set<string>(),
        error: error instanceof Error ? error.message : 'Could not load field visibility.',
      })),
  ]);
  if (existingResult.error) return { message: existingResult.error.message };
  if (!existingResult.data) return { message: 'This record no longer exists.' };
  if (customFields.error) return { message: `Could not load the field catalog: ${customFields.error.message}` };
  if (settings.error) return { message: settings.error };

  const existing = {
    ...(existingResult.data as LandSale),
    extras: (existingResult.data as LandSale).extras ?? {},
  };
  const catalogLabels = (customFields.data ?? []).map(row => row.label as string);
  const availableExtraLabels = resultColumns({ catalogLabels, records: [existing] })
    .flatMap(column => column.kind === 'extra' ? [column.key] : []);

  // Carried through from the edit form's hidden `from` field (the results
  // page's filters at the time the user navigated to this edit) purely to
  // relay it onward to the post-save redirect — not part of the record shape.
  const from = formData.get('from');
  formData.delete('from');

  const extrasPresent = formDataHasExtras(formData);
  const extras = extrasFromFormData(formData);
  const raw = Object.fromEntries(formData.entries());
  const parsed = landSaleInputSchema.safeParse(extrasPresent ? { ...raw, extras } : raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] = issue.message;
    return { errors };
  }

  const merged = mergeVisibleUpdate(
    existing,
    parsed.data,
    availableExtraLabels,
    settings.hidden,
  );
  const { extras: mergedExtras, sale_date_raw: mergedSaleDateRaw, ...core } = merged;
  const payload = {
    ...core,
    extras: mergedExtras,
    sale_date_raw: mergedSaleDateRaw ?? null,
  };

  const { error } = await supabase
    .from('land_sales')
    .update(payload)
    .eq('id', id);

  if (error) return { message: error.message };
  await logAudit(supabase, 'Updated Record', `${merged.parcel_id || merged.address || id} updated`);
  redirect(from ? `/land-sales/${id}?from=${encodeURIComponent(String(from))}` : `/land-sales/${id}`);
}

export type ImportOutcome = {
  headerError?: string;
  rowErrors?: string[];
  warnings?: string[];
  duplicates?: string[];
  inserted?: number;
};

/** Re-parses the raw CSV text server-side (never trusts the client parse).
 * Headers must match the import template exactly — extra or renamed columns
 * are rejected rather than mapped or stored as new fields. */
export async function importLandSales(csvText: string): Promise<ImportOutcome> {
  const supabase = await createClient();
  const denied = await landSaleWriteDeniedMessage(supabase);
  if (denied) return { rowErrors: [denied] };

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { headerError: `The CSV is empty. Add a header row: ${csvHeaders.join(', ')}.` };
  }
  const headers = rows[0].map(h => h.trim());
  if (looksLikeWrongDelimiter(headers)) {
    return { headerError: 'This file appears to use semicolons or tabs instead of commas. Re-export it as a comma-separated CSV and try again.' };
  }
  const headerError = csvHeaderError(headers);
  if (headerError) return { headerError };

  const dataRowsRaw = rows.slice(1);
  if (dataRowsRaw.length === 0) {
    return { headerError: 'The CSV contains a header row but no data rows.' };
  }

  const results = validateDataRows(dataRowsRaw);

  const rowErrors = results.filter(r => !r.ok).flatMap(r => (r.ok ? [] : r.errors));
  if (rowErrors.length) return { rowErrors };

  const toInsert: LandSaleInput[] = results.flatMap(r => (r.ok ? [r.data] : []));
  if (!toInsert.length) return { rowErrors: ['No valid rows to import.'] };
  const warnings = results.flatMap(r => (r.ok ? r.warnings ?? [] : []));

  const { data: { user } } = await supabase.auth.getUser();

  const { data: existing } = await supabase.from('land_sales').select('parcel_id, sale_date, address');
  const existingKeys = new Set((existing ?? []).map(r => recordKey(r)));

  const duplicates: string[] = [];
  const fresh: LandSaleInput[] = [];
  for (const row of toInsert) {
    const key = recordKey(row);
    if (existingKeys.has(key)) duplicates.push(row.parcel_id || row.address);
    else fresh.push(row);
  }

  let inserted = 0;
  const chunkSize = 500;
  for (let i = 0; i < fresh.length; i += chunkSize) {
    const chunk = fresh.slice(i, i + chunkSize).map(row => ({ ...row, created_by: user?.id ?? null }));
    const { error, count } = await supabase.from('land_sales').insert(chunk, { count: 'exact' });
    if (error) return { rowErrors: [error.message], duplicates, inserted };
    inserted += count ?? chunk.length;
  }

  if (inserted > 0) {
    const dupNote = duplicates.length ? `, ${duplicates.length} duplicate${duplicates.length === 1 ? '' : 's'} skipped` : '';
    await logAudit(supabase, 'Imported CSV', `${inserted} record${inserted === 1 ? '' : 's'} imported${dupNote}`);
  }

  return { inserted, duplicates, warnings: warnings.length ? warnings : undefined };
}
