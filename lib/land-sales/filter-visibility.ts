import { appFieldNames } from './app-fields';
import type { ResultColumn } from './result-columns';
import type { LandSaleFilters } from './search-params';

/** Configuration is untrusted; stale or malformed entries never hide a new field. */
export function readHiddenFilterKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(appFieldNames());
  return [...new Set(value.filter((key): key is string => typeof key === 'string' && known.has(key)))];
}

/** Search can only narrow by columns the table displays. This never changes
 * the column arrangement itself or the record form's fields. */
export function searchFilterColumns(
  columns: readonly ResultColumn[],
  hiddenFields: ReadonlySet<string>,
  hiddenFilters: ReadonlySet<string>,
): ResultColumn[] {
  return columns.filter(column => !hiddenFields.has(column.key) && !hiddenFilters.has(column.key));
}

/** Ignore unavailable criteria from old links, including the legacy URL
 * vocabulary. Keep decoding total and leave the requested URL in place. */
export function effectiveSearchFilters(
  filters: LandSaleFilters,
  columns: readonly ResultColumn[],
): LandSaleFilters {
  const allowed = new Set(columns.map(column => column.key));
  return {
    ...filters,
    state: allowed.has('Property State') ? filters.state : undefined,
    market: allowed.has('Market') ? filters.market : undefined,
    county: allowed.has('Property County') ? filters.county : undefined,
    city: allowed.has('Property City') ? filters.city : undefined,
    types: allowed.has('Secondary Type') ? filters.types : [],
    proposedUses: allowed.has('Proposed Use') ? filters.proposedUses : [],
    sfMin: allowed.has('Land Area SF') ? filters.sfMin : undefined,
    sfMax: allowed.has('Land Area SF') ? filters.sfMax : undefined,
    acMin: allowed.has('Land Area AC') ? filters.acMin : undefined,
    acMax: allowed.has('Land Area AC') ? filters.acMax : undefined,
    buildingSfMin: allowed.has('Building SF') ? filters.buildingSfMin : undefined,
    buildingSfMax: allowed.has('Building SF') ? filters.buildingSfMax : undefined,
    time: allowed.has('Sale Date') ? filters.time : undefined,
    fieldFilters: (filters.fieldFilters ?? []).filter(filter => allowed.has(filter.column)),
  };
}

export type SearchFilterSelection =
  | { ok: true; hiddenFilterIds: string[] }
  | { ok: false; message: string };

/** Preserve preferences for temporarily hidden columns, but never let a
 * crafted submission make one of those columns available as a filter. */
export function validateSearchFilterSelection(
  values: readonly FormDataEntryValue[],
  columns: readonly ResultColumn[],
  hiddenFields: ReadonlySet<string>,
  previouslyHidden: ReadonlySet<string>,
): SearchFilterSelection {
  const eligible = new Set(searchFilterColumns(columns, hiddenFields, new Set()).map(column => column.key));
  if (values.some(value => typeof value !== 'string' || !eligible.has(value))) {
    return { ok: false, message: 'Only displayed results columns can be selected as search filters. Reload these settings and try again.' };
  }
  const visible = new Set(values);
  if (visible.size !== values.length) {
    return { ok: false, message: 'The search filter selection contains a duplicate field.' };
  }
  return {
    ok: true,
    hiddenFilterIds: columns.filter(column => eligible.has(column.key)
      ? !visible.has(column.key)
      : previouslyHidden.has(column.key)).map(column => column.key),
  };
}
