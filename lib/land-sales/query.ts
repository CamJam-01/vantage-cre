import type { SupabaseClient } from '@supabase/supabase-js';
import type { LandSaleFilters } from './search-params';
import { landSaleFromRow } from './db';
import type { LandSale } from './schema';
import { chunkIds } from './export-ids';
import { splitProposedUseLabels, uniqueProposedUseLabels } from './proposed-use';
import { DEFAULT_RESULTS_SORT, type ResultsSort } from './results-sort';
import { LAND_SALES_PATH, type SalesTable } from './sales-path';
import {
  SEARCH_SUGGESTION_COLUMNS,
  emptySearchSuggestionDependencies,
  indexDependentValues,
  type SearchSuggestionDependencies,
  type SearchSuggestions,
} from './search-sheet';

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
  | { op: 'overlaps'; column: string; value: string[] }
  | { op: 'gte'; column: string; value: string | number }
  | { op: 'lte'; column: string; value: string | number };

export function landSaleFilterClauses(filters: LandSaleFilters): FilterClause[] {
  const clauses: FilterClause[] = [];
  if (filters.state) clauses.push({ op: 'eq', column: 'Property State', value: filters.state });
  if (filters.county) clauses.push({ op: 'ilike', column: 'Property County', value: `%${filters.county}%` });
  if (filters.city) clauses.push({ op: 'ilike', column: 'Property City', value: `%${filters.city}%` });
  if (filters.market) clauses.push({ op: 'ilike', column: 'Market', value: `%${filters.market}%` });
  if (filters.types.length) clauses.push({ op: 'in', column: 'Secondary Type', value: [...filters.types] });
  if (filters.proposedUses.length) clauses.push({ op: 'overlaps', column: 'proposed_use_labels', value: [...filters.proposedUses] });
  if (filters.sfMin != null) clauses.push({ op: 'gte', column: 'Land Area SF', value: filters.sfMin });
  if (filters.sfMax != null) clauses.push({ op: 'lte', column: 'Land Area SF', value: filters.sfMax });
  if (filters.acMin != null) clauses.push({ op: 'gte', column: 'Land Area AC', value: filters.acMin });
  if (filters.acMax != null) clauses.push({ op: 'lte', column: 'Land Area AC', value: filters.acMax });
  if (filters.buildingSfMin != null) clauses.push({ op: 'gte', column: 'Building SF', value: filters.buildingSfMin });
  if (filters.buildingSfMax != null) clauses.push({ op: 'lte', column: 'Building SF', value: filters.buildingSfMax });

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

type FilterableQuery = {
  eq: (column: string, value: string | number | boolean) => FilterableQuery;
  ilike: (column: string, value: string) => FilterableQuery;
  in: (column: string, value: string[]) => FilterableQuery;
  overlaps: (column: string, value: string[]) => FilterableQuery;
  gte: (column: string, value: string | number) => FilterableQuery;
  lte: (column: string, value: string | number) => FilterableQuery;
};

/** Apply decoded filter clauses without dragging Supabase's builder generics
 * into a deep instantiation (those explode under recursive `.eq().ilike()…`). */
function withLandSaleFilters<T>(query: T, filters: LandSaleFilters): T {
  let next = query as unknown as FilterableQuery;
  for (const clause of landSaleFilterClauses(filters)) {
    switch (clause.op) {
      case 'eq':
        next = next.eq(clause.column, clause.value);
        break;
      case 'ilike':
        next = next.ilike(clause.column, clause.value);
        break;
      case 'in':
        next = next.in(clause.column, clause.value);
        break;
      case 'overlaps':
        next = next.overlaps(clause.column, clause.value);
        break;
      case 'gte':
        next = next.gte(clause.column, clause.value);
        break;
      case 'lte':
        next = next.lte(clause.column, clause.value);
        break;
      default: {
        const _exhaustive: never = clause;
        void _exhaustive;
      }
    }
  }
  return next as T;
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
  table: SalesTable = LAND_SALES_PATH.table,
) {
  const head = page !== undefined && 'head' in page && page.head;
  let query = supabase
    .from(table)
    .select('*', { count: 'exact', head })
    .order(sort.column, { ascending: sort.dir === 'asc', nullsFirst: false })
    .order('id', { ascending: true });
  query = withLandSaleFilters(query, filters);
  if (page && 'from' in page) query = query.range(page.from, page.to);
  return query;
}

function formatOrColumn(column: string): string {
  return `"${column.replace(/"/g, '""')}"`;
}

function formatOrValue(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = String(value);
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function isMissingSortValue(value: unknown): boolean {
  return value == null || value === '';
}

type NeighborQuery = {
  is: (column: string, value: null) => NeighborQuery;
  filter: (column: string, operator: string, value: string) => NeighborQuery;
  or: (filters: string) => NeighborQuery;
  order: (column: string, options: { ascending: boolean; nullsFirst?: boolean }) => NeighborQuery;
  limit: (count: number) => PromiseLike<{ data: Array<{ id?: string }> | null; error: { message: string } | null }>;
};

/** Apply the keyset clause for a row earlier/later in filtered sort order. */
function withNeighborKeyset<T>(
  query: T,
  sort: ResultsSort,
  currentId: string,
  currentSortValue: unknown,
  direction: 'prev' | 'next',
): T {
  const ascending = sort.dir === 'asc';
  const forward = direction === 'next';
  const col = formatOrColumn(sort.column);
  const idOp = forward ? 'gt' : 'lt';
  const wantGreaterSort = forward ? ascending : !ascending;
  const primaryOp = wantGreaterSort ? 'gt' : 'lt';
  let next = query as unknown as NeighborQuery;

  if (isMissingSortValue(currentSortValue)) {
    if (forward) {
      next = next.is(sort.column, null).filter('id', idOp, currentId);
    } else {
      next = next.or(`${col}.not.is.null,and(${col}.is.null,id.${idOp}.${currentId})`);
    }
  } else {
    const value = formatOrValue(currentSortValue);
    let orFilter =
      `${col}.${primaryOp}.${value},and(${col}.eq.${value},id.${idOp}.${currentId})`;
    // Nulls sort last in both directions; they only follow a non-null current row.
    if (forward) orFilter += `,${col}.is.null`;
    next = next.or(orFilter);
  }
  return next as T;
}

/** One step earlier/later in the same filtered + sorted result order as
 * `applyLandSaleFilters` (sort column, then `id` ascending, nulls last). */
async function fetchNeighborLandSaleId(
  supabase: SupabaseClient,
  filters: LandSaleFilters,
  sort: ResultsSort,
  currentId: string,
  currentSortValue: unknown,
  direction: 'prev' | 'next',
  table: SalesTable,
): Promise<string | null> {
  const ascending = sort.dir === 'asc';
  const forward = direction === 'next';

  let query = supabase.from(table).select('id');
  query = withLandSaleFilters(query, filters);
  query = withNeighborKeyset(query, sort, currentId, currentSortValue, direction);

  if (forward) {
    query = query
      .order(sort.column, { ascending, nullsFirst: false })
      .order('id', { ascending: true });
  } else {
    query = query
      .order(sort.column, { ascending: !ascending, nullsFirst: true })
      .order('id', { ascending: false });
  }

  const { data, error } = await query.limit(1);
  if (error) throw new Error(error.message);
  const id = data?.[0]?.id;
  return typeof id === 'string' && id ? id : null;
}

async function countFilteredLandSales(
  supabase: SupabaseClient,
  filters: LandSaleFilters,
  table: SalesTable,
): Promise<number> {
  const { count, error } = await applyLandSaleFilters(supabase, filters, { head: true }, DEFAULT_RESULTS_SORT, table);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** How many filtered rows sort strictly before the current record. */
async function countPrecedingLandSales(
  supabase: SupabaseClient,
  filters: LandSaleFilters,
  sort: ResultsSort,
  currentId: string,
  currentSortValue: unknown,
  table: SalesTable,
): Promise<number> {
  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true });
  query = withLandSaleFilters(query, filters);
  query = withNeighborKeyset(query, sort, currentId, currentSortValue, 'prev');
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function landSaleMatchesFilters(
  supabase: SupabaseClient,
  filters: LandSaleFilters,
  currentId: string,
  table: SalesTable,
): Promise<boolean> {
  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('id', currentId);
  query = withLandSaleFilters(query, filters);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/** Previous/next record ids and 1-based position in the filtered result set
 * the details page was opened from. Missing `from` still walks the full
 * catalog order. */
export async function fetchAdjacentLandSaleIds(
  supabase: SupabaseClient,
  filters: LandSaleFilters,
  sort: ResultsSort,
  currentId: string,
  currentSortValue: unknown,
  table: SalesTable = LAND_SALES_PATH.table,
): Promise<{
  prevId: string | null;
  nextId: string | null;
  position: number | null;
  total: number;
}> {
  const [prevId, nextId, total, preceding, inSet] = await Promise.all([
    fetchNeighborLandSaleId(supabase, filters, sort, currentId, currentSortValue, 'prev', table),
    fetchNeighborLandSaleId(supabase, filters, sort, currentId, currentSortValue, 'next', table),
    countFilteredLandSales(supabase, filters, table),
    countPrecedingLandSales(supabase, filters, sort, currentId, currentSortValue, table),
    landSaleMatchesFilters(supabase, filters, currentId, table),
  ]);
  return {
    prevId,
    nextId,
    position: inSet ? preceding + 1 : null,
    total,
  };
}

/** Unique non-empty "Secondary Type" values, used to populate the search page's type filters. */
export async function getDistinctSecondaryTypes(
  supabase: SupabaseClient,
  table: SalesTable = LAND_SALES_PATH.table,
): Promise<string[]> {
  const { data, error } = table === LAND_SALES_PATH.table
    ? await supabase.rpc('distinct_secondary_types')
    : await supabase.rpc('distinct_secondary_types', { p_table: table });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error('distinct_secondary_types returned an invalid response.');
  const values = data.filter((value): value is string => typeof value === 'string' && value.trim() !== '');
  return [...new Set(values.map(value => value.trim()))].sort((a, b) => a.localeCompare(b));
}

/** Unique Proposed Use tokens after splitting combined cells, for the search chips. */
export async function getDistinctProposedUses(
  supabase: SupabaseClient,
  table: SalesTable = LAND_SALES_PATH.table,
): Promise<string[]> {
  const { data, error } = table === LAND_SALES_PATH.table
    ? await supabase.rpc('distinct_proposed_uses')
    : await supabase.rpc('distinct_proposed_uses', { p_table: table });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error('distinct_proposed_uses returned an invalid response.');
  const values = data.filter((value): value is string => typeof value === 'string' && value.trim() !== '');
  return uniqueProposedUseLabels(values);
}

const DISTINCT_CATALOG_COLUMNS = new Set([
  'Property City',
  'Property State',
  'Property County',
  'Market',
  'Submarket Name',
  'Property Type',
  'Secondary Type',
  'Sale Type',
  'Sale Status',
]);

function normalizeDistinctValues(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const values = data.flatMap(entry => {
    if (typeof entry === 'string') return [entry];
    if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      const value = Object.values(record)[0];
      return typeof value === 'string' ? [value] : [];
    }
    return [];
  });
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

/** Fallback when the distinct RPC is not deployed yet: scan a capped page of
 * rows and unique them in process. Prefer the RPC once the migration is live. */
async function getDistinctCatalogValuesViaSelect(
  supabase: SupabaseClient,
  column: string,
  table: SalesTable,
): Promise<string[]> {
  const { data, error } = await supabase
    .from(table)
    .select(`"${column}"`)
    .not(`"${column}"`, 'is', null)
    .limit(5000);
  if (error) throw new Error(error.message);
  return normalizeDistinctValues(data);
}

/** Unique non-empty values for a whitelisted catalog text column. */
export async function getDistinctCatalogValues(
  supabase: SupabaseClient,
  column: string,
  table: SalesTable = LAND_SALES_PATH.table,
): Promise<string[]> {
  if (!DISTINCT_CATALOG_COLUMNS.has(column)) {
    throw new Error(`distinct_catalog_values does not allow column "${column}".`);
  }
  const { data, error } = await supabase.rpc('distinct_catalog_values', {
    p_table: table,
    p_column: column,
  });
  if (error) {
    // Migration not applied yet — degrade to a capped table scan so search
    // comboboxes still list known values instead of staying empty.
    if (/could not find|does not exist|schema cache/i.test(error.message)) {
      return getDistinctCatalogValuesViaSelect(supabase, column, table);
    }
    throw new Error(error.message);
  }
  if (!Array.isArray(data)) throw new Error('distinct_catalog_values returned an invalid response.');
  return normalizeDistinctValues(data);
}

/** Suggestion lists for the Land search combobox fields. Missing RPCs or a
 * single-column failure yield an empty list for that field so the sheet still
 * loads and free-text entry remains available. */
export async function loadSearchSuggestions(
  supabase: SupabaseClient,
  table: SalesTable = LAND_SALES_PATH.table,
): Promise<SearchSuggestions> {
  const entries = await Promise.all(
    SEARCH_SUGGESTION_COLUMNS.map(async column => {
      try {
        const values = column === 'Proposed Use'
          ? await getDistinctProposedUses(supabase, table)
          : column === 'Secondary Type'
            ? await getDistinctSecondaryTypes(supabase, table)
            : await getDistinctCatalogValues(supabase, column, table);
        return [column, values] as const;
      } catch {
        return [column, [] as string[]] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

function textCell(record: Record<string, unknown>, column: string): string {
  const value = record[column];
  return typeof value === 'string' ? value : '';
}

function pushPair(
  pairs: { parent: string; child: string }[],
  parent: string,
  child: string,
) {
  const p = parent.trim();
  const c = child.trim();
  if (p && c) pairs.push({ parent: p, child: c });
}

/** Observed parent→child value pairs from a capped row scan for dependent
 * search comboboxes (City←State, Market←State, Submarket←Market,
 * Secondary Type / Proposed Use ← Property Type). */
export async function loadSearchSuggestionDependencies(
  supabase: SupabaseClient,
  table: SalesTable = LAND_SALES_PATH.table,
): Promise<SearchSuggestionDependencies> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select([
        '"Property State"',
        '"Property City"',
        '"Property County"',
        '"Market"',
        '"Submarket Name"',
        '"Property Type"',
        '"Secondary Type"',
        '"Proposed Use"',
      ].join(', '))
      .limit(5000);
    if (error) throw new Error(error.message);

    const cityPairs: { parent: string; child: string }[] = [];
    const countyPairs: { parent: string; child: string }[] = [];
    const marketPairs: { parent: string; child: string }[] = [];
    const submarketPairs: { parent: string; child: string }[] = [];
    const secondaryPairs: { parent: string; child: string }[] = [];
    const proposedUsePairs: { parent: string; child: string }[] = [];

    for (const row of data ?? []) {
      const record = row as unknown as Record<string, unknown>;
      const state = textCell(record, 'Property State');
      const city = textCell(record, 'Property City');
      const county = textCell(record, 'Property County');
      const market = textCell(record, 'Market');
      const submarket = textCell(record, 'Submarket Name');
      const propertyType = textCell(record, 'Property Type');
      const secondaryType = textCell(record, 'Secondary Type');
      const proposedUse = textCell(record, 'Proposed Use');

      pushPair(cityPairs, state, city);
      pushPair(countyPairs, state, county);
      pushPair(marketPairs, state, market);
      pushPair(submarketPairs, market, submarket);
      pushPair(secondaryPairs, propertyType, secondaryType);
      for (const label of splitProposedUseLabels(proposedUse)) {
        pushPair(proposedUsePairs, propertyType, label);
      }
    }

    return {
      citiesByState: indexDependentValues(cityPairs),
      countiesByState: indexDependentValues(countyPairs),
      marketsByState: indexDependentValues(marketPairs),
      submarketsByMarket: indexDependentValues(submarketPairs),
      secondaryTypesByPropertyType: indexDependentValues(secondaryPairs),
      proposedUsesByPropertyType: indexDependentValues(proposedUsePairs),
    };
  } catch {
    return emptySearchSuggestionDependencies;
  }
}

/** Full catalog rows for export, in the order the caller asked. Chunks the
 * `in` filter so a large selection cannot overflow PostgREST's URL limit. */
export async function fetchLandSalesByIds(
  supabase: SupabaseClient,
  ids: readonly string[],
  table: SalesTable = LAND_SALES_PATH.table,
): Promise<{ records: LandSale[]; error: string | null }> {
  const records: LandSale[] = [];
  const byId = new Map<string, LandSale>();
  for (const chunk of chunkIds(ids)) {
    if (!chunk.length) continue;
    const { data, error } = await supabase.from(table).select('*').in('id', chunk);
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
