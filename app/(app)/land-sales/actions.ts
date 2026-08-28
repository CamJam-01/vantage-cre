'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/log';
import { landSaleFromRow, landSaleToRow } from '@/lib/land-sales/db';
import { columnsFromFormData } from '@/lib/land-sales/schema';
import {
  looksLikeWrongDelimiter, parseCsv, recordKey, csvHeaderError,
  importLandSaleRow, validateDataRows, duplicateLabel, splitFreshAndDuplicates,
  RECORD_KEY_COLUMNS,
} from '@/lib/land-sales/csv';
import {
  landSaleDeleteDeniedMessage,
  landSaleWriteDeniedMessage,
} from '@/lib/users/roles';
import { loadHiddenFieldIds } from '@/lib/land-sales/display-settings';
import { SALES_DATABASE_KEY } from '@/lib/land-sales/field-visibility';
import { mergeVisibleUpdate, sanitizeVisibleCreate } from '@/lib/land-sales/visible-record-input';

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export type CreateFormState = { errors?: Record<string, string>; message?: string } | null;

function recordLabel(columns: Record<string, unknown>, fallback: string): string {
  const address = columns['Property Address'];
  const parcel = columns['Parcel Number 1 (Min)'];
  if (typeof address === 'string' && address.trim()) return address.trim();
  if (typeof parcel === 'string' && parcel.trim()) return parcel.trim();
  return fallback;
}

export async function createLandSale(_prevState: CreateFormState, formData: FormData): Promise<CreateFormState> {
  const supabase = await createClient();
  const denied = await landSaleWriteDeniedMessage(supabase);
  if (denied) return { message: denied };

  const settings = await loadHiddenFieldIds(supabase, SALES_DATABASE_KEY)
    .then(hidden => ({ hidden, error: null as string | null }))
    .catch((error: unknown) => ({
      hidden: new Set<string>(),
      error: error instanceof Error ? error.message : 'Could not load field visibility.',
    }));
  if (settings.error) return { message: settings.error };

  const submitted = columnsFromFormData(formData, settings.hidden);
  const sanitized = sanitizeVisibleCreate(submitted, settings.hidden);

  const { error } = await supabase
    .from('land_sales')
    .insert(landSaleToRow(sanitized));

  if (error) return { message: error.message };
  await logAudit(supabase, 'Created Record', `${recordLabel(sanitized.columns, 'record')} added`);
  redirect('/land-sales');
}

/** Bound to the record id via `updateLandSale.bind(null, id)` when wired into
 * useActionState. Editing a visible date supersedes its raw import flag;
 * hiding the date preserves both stored date fields untouched. */
export async function updateLandSale(id: string, _prevState: CreateFormState, formData: FormData): Promise<CreateFormState> {
  const supabase = await createClient();
  const denied = await landSaleWriteDeniedMessage(supabase);
  if (denied) return { message: denied };

  const [existingResult, settings] = await Promise.all([
    supabase.from('land_sales').select('*').eq('id', id).maybeSingle(),
    loadHiddenFieldIds(supabase, SALES_DATABASE_KEY)
      .then(hidden => ({ hidden, error: null as string | null }))
      .catch((error: unknown) => ({
        hidden: new Set<string>(),
        error: error instanceof Error ? error.message : 'Could not load field visibility.',
      })),
  ]);
  if (existingResult.error) return { message: existingResult.error.message };
  if (!existingResult.data) return { message: 'This record no longer exists.' };
  if (settings.error) return { message: settings.error };

  const existing = landSaleFromRow(existingResult.data as Record<string, unknown>);
  if (!existing) return { message: 'This record is missing its identity and cannot be updated.' };

  const from = formData.get('from');
  formData.delete('from');

  const submitted = columnsFromFormData(formData, settings.hidden);
  const merged = mergeVisibleUpdate(existing, submitted, settings.hidden);
  const { error } = await supabase
    .from('land_sales')
    .update(landSaleToRow(merged))
    .eq('id', id);

  if (error) return { message: error.message };
  await logAudit(supabase, 'Updated Record', `${recordLabel(merged.columns, id)} updated`);
  redirect(from ? `/land-sales/${id}?from=${encodeURIComponent(String(from))}` : `/land-sales/${id}`);
}

export type DeleteFormState = { error?: string } | null;

export async function deleteLandSale(id: string): Promise<DeleteFormState> {
  const supabase = await createClient();
  const denied = await landSaleDeleteDeniedMessage(supabase);
  if (denied) return { error: denied };

  const { data: existing } = await supabase
    .from('land_sales')
    .select('"Property Address","Parcel Number 1 (Min)"')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('land_sales').delete().eq('id', id);
  if (error) return { error: error.message };

  await logAudit(supabase, 'Deleted Record', `${existing ? recordLabel(existing as Record<string, unknown>, id) : id} deleted`);
  revalidatePath('/land-sales');
  redirect('/land-sales');
}

export async function deleteLandSales(ids: string[]): Promise<DeleteFormState> {
  const supabase = await createClient();
  const denied = await landSaleDeleteDeniedMessage(supabase);
  if (denied) return { error: denied };

  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return { error: 'No records selected.' };

  const { error } = await supabase.from('land_sales').delete().in('id', unique);
  if (error) return { error: error.message };

  await logAudit(
    supabase,
    'Deleted Records',
    `${unique.length} record${unique.length === 1 ? '' : 's'} deleted`,
  );
  revalidatePath('/land-sales');
  return null;
}

export type ImportOutcome = {
  headerError?: string;
  rowErrors?: string[];
  warnings?: string[];
  duplicates?: string[];
  inserted?: number;
  awaitingConfirmation?: boolean;
  freshCount?: number;
};

/** Re-parses the raw CSV text server-side (never trusts the client parse).
 * Headers must match the import template exactly — extra or renamed columns
 * are rejected rather than mapped or stored as new fields. Duplicates halt
 * the import until the caller explicitly chooses to import the rest. */
export async function importLandSales(
  csvText: string,
  options?: { importNonDuplicates?: boolean },
): Promise<ImportOutcome> {
  const supabase = await createClient();
  const denied = await landSaleWriteDeniedMessage(supabase);
  if (denied) return { rowErrors: [denied] };

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { headerError: 'The CSV is empty. Download the CSV template and use those headers.' };
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

  const toInsert = results.flatMap(r => (r.ok ? [r] : []));
  if (!toInsert.length) return { rowErrors: ['No valid rows to import.'] };
  const warnings = results.flatMap(r => (r.ok ? r.warnings ?? [] : []));

  const { data: existing } = await supabase
    .from('land_sales')
    .select(RECORD_KEY_COLUMNS.map(name => `"${name}"`).join(','));
  const existingRows = Array.isArray(existing) ? existing : [];
  const existingKeys = new Set(
    existingRows.map(r => recordKey(r as unknown as Record<string, unknown>)),
  );

  const prepared = toInsert.map(row => ({
    columns: importLandSaleRow(row),
    label: duplicateLabel(row.data.columns),
  }));
  const { fresh, duplicates } = splitFreshAndDuplicates(prepared, existingKeys);

  if (duplicates.length && !options?.importNonDuplicates) {
    return {
      duplicates,
      awaitingConfirmation: true,
      freshCount: fresh.length,
      warnings: warnings.length ? warnings : undefined,
    };
  }

  let inserted = 0;
  const chunkSize = 500;
  for (let i = 0; i < fresh.length; i += chunkSize) {
    const chunk = fresh.slice(i, i + chunkSize);
    const { error, count } = await supabase.from('land_sales').insert(chunk, { count: 'exact' });
    if (error) return { rowErrors: [error.message], duplicates, inserted };
    inserted += count ?? chunk.length;
  }

  if (inserted > 0) {
    await logAudit(supabase, 'Imported CSV', `${inserted} record${inserted === 1 ? '' : 's'} imported`);
  }

  return { inserted, warnings: warnings.length ? warnings : undefined };
}
