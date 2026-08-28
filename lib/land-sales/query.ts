import type { SupabaseClient } from '@supabase/supabase-js';
import type { LandSaleFilters } from './search-params';
import { landSaleFromRow } from './db';
import type { LandSale } from './schema';
import { chunkIds } from './export-ids';
import { DEFAULT_RESULTS_SORT, type ResultsSort } from './results-sort';

function lastDurationToDate(duration: number, unit: 'months' | 'years'): string | null {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const d = new Date();
  if (unit === 'months') d.setMonth(d.getMonth() - duration);
  else d.setFullYear(d.getFullYear() - duration);
  return d.toISOString().slice(0, 10);
}

export type FilterClause =
  | { op: 'eq'; column: string; value: string | number | boolean }
  | { op: 'ilike'; column: string; value: string }
  | { op: 'in'; column: string; value: string[] }
  | { op: 'gte'; column: string; value: string | number }
  | { op: 'lte'; column: string; value: string | number };

export function landSaleFilterClauses(filters: LandSaleFilters): FilterClause[] {
  const clauses: FilterClause[] = [];
  if (filters.state) clauses.push({ op: 'eq', column: 'Property State', value: filters.state });
  if (filters.county) clauses.push({ op: 'ilike', column: 'Property County', value: `%${filters.county}%` });
  if (filters.city) clauses.push({ op: 'ilike', column: 'Property City', value: `%${filters.city}%` });
  if (filters.market) clauses.push({ op: 'ilike', column: 'Market', value: `%${filters.market}%` });
  if (filters.types.length) clauses.push({ op: 'in', column: 'Secondary Type', value: [...filters.types] });
  if (filters.sfMin != null) clauses.push({ op: 'gte', column: 'Land Area SF', value: filters.sfMin });
  if (filters.sfMax != null) clauses.push({ op: 'lte', column: 'Land Area SF', value: filters.sfMax });
  if (filters.acMin != null) clauses.push({ op: 'gte', column: 'Land Area AC', value: filters.acMin });
  if (filters.acMax != null) clauses.push({ op: 'lte', column: 'Land Area AC', value: filters.acMax });

  if (filters.time?.mode === 'range') {
    if (filters.time.from) clauses.push({ op: 'gte', column: 'Sale Date', value: filters.time.from });
    if (filters.time.to) clauses.push({ op: 'lte', column: 'Sale Date', value: filters.time.to });
  } else if (filters.time?.mode === 'last') {
    const from = lastDurationToDate(filters.time.duration, filters.time.unit);
    if (from) clauses.push({ op: 'gte', column: 'Sale Date', value: from });
  }

  for (const filter of filters.fieldFilters ?? []) {
    switch (filter.kind) {
      case 'text':
        clauses.push({ op: 'ilike', column: filter.column, value: `%${filter.contains}%` });
        break;
      case 'number':
        if (filter.min != null) clauses.push({ op: 'gte', column: filter.column, value: filter.min });
        if (filter.max != null) clauses.push({ op: 'lte', column: filter.column, value: filter.max });
        break;
      case 'date':
        if (filter.from) clauses.push({ op: 'gte', column: filter.column, value: filter.from });
        if (filter.to) clauses.push({ op: 'lte', column: filter.column, value: filter.to });
        break;
      case 'boolean':
        clauses.push({ op: 'eq', column: filter.column, value: filter.value });
        break;
      default: {
        const _exhaustive: never = filter;
        void _exhaustive;
      }
    }
  }
  return clauses;
}

export type LandSaleQueryPage =
  | { from: number; to: number }
  | { head: true };

/** PostgREST answers a range past the last row with 416. A hand-edited
 * `?page=` must still render, so the results child treats this as empty. */
export function isUnsatisfiableRangeError(error: { message?: string } | null): boolean {
  return Boolean(error?.message && /requested range not satisfiable/i.test(error.message));
}

/** Translates decoded URL filters into a Supabase query. Shared by the results page
 * (fetch) and the CSV-duplicate check during import (count-only). Pagination is
 * optional so a caller can still take a filtered count without a range. Sort
 * is applied before the range so a header click ranks the full match, not
 * the current page. */
export function applyLandSaleFilters(
  supabase: SupabaseClient,
  filters: LandSaleFilters,
  page?: LandSaleQueryPage,
  sort: ResultsSort = DEFAULT_RESULTS_SORT,
) {
  const head = page !== undefined && 'head' in page && page.head;
  let query = supabase
    .from('land_sales')
    .select('*', { count: 'exact', head })
    .order(sort.column, { ascending: sort.dir === 'asc', nullsFirst: false })
    .order('id', { ascending: true });
  for (const clause of landSaleFilterClauses(filters)) {
    switch (clause.op) {
      case 'eq':
        query = query.eq(clause.column, clause.value);
        break;
      case 'ilike':
        query = query.ilike(clause.column, clause.value);
        break;
      case 'in':
        query = query.in(clause.column, clause.value);
        break;
      case 'gte':
        query = query.gte(clause.column, clause.value);
        break;
      case 'lte':
        query = query.lte(clause.column, clause.value);
        break;
      default: {
        const _exhaustive: never = clause;
        void _exhaustive;
      }
    }
  }
  if (page && 'from' in page) query = query.range(page.from, page.to);
  return query;
}

/** Unique non-empty "Secondary Type" values, used to populate the search page's type filters. */
export async function getDistinctSecondaryTypes(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.rpc('distinct_secondary_types');
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error('distinct_secondary_types returned an invalid response.');
  const values = data.filter((value): value is string => typeof value === 'string' && value.trim() !== '');
  return [...new Set(values.map(value => value.trim()))].sort((a, b) => a.localeCompare(b));
}

/** Full catalog rows for export, in the order the caller asked. Chunks the
 * `in` filter so a large selection cannot overflow PostgREST's URL limit. */
export async function fetchLandSalesByIds(
  supabase: SupabaseClient,
  ids: readonly string[],
): Promise<{ records: LandSale[]; error: string | null }> {
  const records: LandSale[] = [];
  const byId = new Map<string, LandSale>();
  for (const chunk of chunkIds(ids)) {
    if (!chunk.length) continue;
    const { data, error } = await supabase.from('land_sales').select('*').in('id', chunk);
    if (error) return { records: [], error: error.message };
    for (const row of data ?? []) {
      const record = landSaleFromRow(row as Record<string, unknown>);
      if (record) byId.set(record.id, record);
    }
  }
  for (const id of ids) {
    const record = byId.get(id);
    if (record) records.push(record);
  }
  return { records, error: null };
}
