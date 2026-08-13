'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/log';
import { landSaleInputSchema, type LandSaleInput } from '@/lib/land-sales/schema';
import {
  applyHeaderMapping, csvHeaders, headersMatchExactly, looksLikeWrongDelimiter,
  missingRequiredMappings, parseCsv, recordKey, suggestHeaderMapping, validateDataRows,
  type ColumnMapping,
} from '@/lib/land-sales/csv';

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export type CreateFormState = { errors?: Record<string, string>; message?: string } | null;

export async function createLandSale(_prevState: CreateFormState, formData: FormData): Promise<CreateFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = landSaleInputSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] = issue.message;
    return { errors };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('land_sales')
    .insert({ ...parsed.data, created_by: user?.id ?? null })
    .select('id')
    .single();

  if (error) return { message: error.message };
  await logAudit(supabase, 'Created Record', `${parsed.data.parcel_id || parsed.data.address || data.id} added`);
  redirect(`/land-sales/${data.id}`);
}

/** Bound to the record id via `updateLandSale.bind(null, id)` when wired into
 * useActionState — the edit form always submits a valid date through the
 * native date picker, so a successful edit always supersedes and clears any
 * `sale_date_raw` import flag. */
export async function updateLandSale(id: string, _prevState: CreateFormState, formData: FormData): Promise<CreateFormState> {
  // Carried through from the edit form's hidden `from` field (the results
  // page's filters at the time the user navigated to this edit) purely to
  // relay it onward to the post-save redirect — not part of the record shape.
  const from = formData.get('from');
  formData.delete('from');

  const raw = Object.fromEntries(formData.entries());
  const parsed = landSaleInputSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] = issue.message;
    return { errors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('land_sales')
    .update({ ...parsed.data, sale_date_raw: null })
    .eq('id', id);

  if (error) return { message: error.message };
  await logAudit(supabase, 'Updated Record', `${parsed.data.parcel_id || parsed.data.address || id} updated`);
  redirect(from ? `/land-sales/${id}?from=${encodeURIComponent(String(from))}` : `/land-sales/${id}`);
}

export type ImportOutcome = {
  headerError?: string;
  needsMapping?: { headers: string[]; suggested: ColumnMapping };
  rowErrors?: string[];
  warnings?: string[];
  duplicates?: string[];
  inserted?: number;
};

/** Re-parses the raw CSV text server-side (never trusts the client parse or its
 * mapping choices for anything beyond reshaping columns — every value still goes
 * through schema validation below). If headers match the expected set exactly,
 * imports immediately; otherwise a mapping must be supplied (from the header-
 * mapping step in the UI) or this returns `needsMapping` for the caller to act on. */
export async function importLandSales(csvText: string, mapping?: ColumnMapping): Promise<ImportOutcome> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { headerError: `The CSV is empty. Add a header row: ${csvHeaders.join(', ')}.` };
  }
  const headers = rows[0].map(h => h.trim());
  if (looksLikeWrongDelimiter(headers)) {
    return { headerError: 'This file appears to use semicolons or tabs instead of commas. Re-export it as a comma-separated CSV and try again.' };
  }
  const dataRowsRaw = rows.slice(1);
  if (dataRowsRaw.length === 0) {
    return { headerError: 'The CSV contains a header row but no data rows.' };
  }

  let effectiveMapping = mapping;
  if (!effectiveMapping) {
    if (headersMatchExactly(headers)) {
      effectiveMapping = suggestHeaderMapping(headers);
    } else {
      return { needsMapping: { headers, suggested: suggestHeaderMapping(headers) } };
    }
  }

  const missing = missingRequiredMappings(effectiveMapping);
  if (missing.length) {
    return { rowErrors: [`Map a column for: ${missing.join(', ')}.`] };
  }

  const mappedRows = applyHeaderMapping(dataRowsRaw, effectiveMapping);
  const results = validateDataRows(mappedRows);

  const rowErrors = results.filter(r => !r.ok).flatMap(r => (r.ok ? [] : r.errors));
  if (rowErrors.length) return { rowErrors };

  const toInsert: LandSaleInput[] = results.flatMap(r => (r.ok ? [r.data] : []));
  if (!toInsert.length) return { rowErrors: ['No valid rows to import.'] };
  const warnings = results.flatMap(r => (r.ok ? r.warnings ?? [] : []));

  const supabase = await createClient();
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
