import type { SupabaseClient } from '@supabase/supabase-js';
import type { LandSaleFilters } from './search-params';

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
  if (filters.msa) clauses.push({ op: 'ilike', column: 'Market', value: `%${filters.msa}%` });
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

/** Translates decoded URL filters into a Supabase query. Shared by the results page
 * (fetch) and the CSV-duplicate check during import (count-only). */export function applyLandSaleFilters(
  supabase: SupabaseClient,
  filters: LandSaleFilters
) {
  let query = supabase.from('land_sales').select('*').order('Sale Date', { ascending: false });
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
  return query;
}

/** Unique non-empty "Secondary Type" values, used to populate the search page's type filters. */
export async function getDistinctSecondaryTypes(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from('land_sales').select('"Secondary Type"');
  const values = new Set<string>();
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const value = row['Secondary Type'];
    if (typeof value === 'string' && value.trim()) values.add(value.trim());
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}
