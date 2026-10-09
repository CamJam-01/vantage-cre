import { costarColumnType } from './costar-column-types';
import {
  appliedToDraft,
  emptyDraftFilter,
  type DraftFieldFilter,
  type FieldFilter,
} from './field-filters';
import type { RecordDisplayPage } from './field-visibility';
import type { LandSaleFilters } from './search-params';

/** Text fields that open a DB-backed suggestion list. Proposed Use stays on
 * the split-label RPC; the rest use `distinct_catalog_values`. */
export const SEARCH_SUGGESTION_COLUMNS = [
  'Property City',
  'Property State',
  'Property County',
  'Market',
  'Submarket Name',
  'Property Type',
  'Secondary Type',
  'Proposed Use',
  'Sale Type',
  'Sale Status',
] as const;

export type SearchSuggestionColumn = (typeof SEARCH_SUGGESTION_COLUMNS)[number];

export type SearchSuggestions = Partial<Record<SearchSuggestionColumn, string[]>>;

export function isSearchSuggestionColumn(column: string): column is SearchSuggestionColumn {
  return (SEARCH_SUGGESTION_COLUMNS as readonly string[]).includes(column);
}

/** Filters the open combobox list; the typed value itself stays whatever the
 * user entered so a custom string never has to match an option. */
export function filterSuggestionOptions(
  options: readonly string[],
  query: string,
): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...options];
  return options.filter(option => option.toLowerCase().includes(needle));
}

/** Parent → child suggestion scopes observed in the catalog. */
export type SearchSuggestionDependencies = {
  citiesByState: Record<string, string[]>;
  countiesByState: Record<string, string[]>;
  marketsByState: Record<string, string[]>;
  submarketsByMarket: Record<string, string[]>;
  secondaryTypesByPropertyType: Record<string, string[]>;
  proposedUsesByPropertyType: Record<string, string[]>;
};

export const emptySearchSuggestionDependencies: SearchSuggestionDependencies = {
  citiesByState: {},
  countiesByState: {},
  marketsByState: {},
  submarketsByMarket: {},
  secondaryTypesByPropertyType: {},
  proposedUsesByPropertyType: {},
};

/** Builds parent→child option maps from observed (parent, child) pairs. */
export function indexDependentValues(
  pairs: readonly { parent: string; child: string }[],
): Record<string, string[]> {
  const buckets = new Map<string, Set<string>>();
  for (const pair of pairs) {
    const parent = pair.parent.trim();
    const child = pair.child.trim();
    if (!parent || !child) continue;
    let set = buckets.get(parent);
    if (!set) {
      set = new Set();
      buckets.set(parent, set);
    }
    set.add(child);
  }
  const indexed: Record<string, string[]> = {};
  for (const [parent, children] of buckets) {
    indexed[parent] = [...children].sort((a, b) => a.localeCompare(b));
  }
  return indexed;
}

type SuggestionParentValues = {
  state: string;
  market: string;
  propertyType: string;
};

function draftTextContains(drafts: readonly DraftFieldFilter[], column: string): string {
  const draft = drafts.find(item => item.column === column);
  return draft?.kind === 'text' ? draft.contains : '';
}

export function suggestionParentValues(drafts: readonly DraftFieldFilter[]): SuggestionParentValues {
  return {
    state: draftTextContains(drafts, 'Property State'),
    market: draftTextContains(drafts, 'Market'),
    propertyType: draftTextContains(drafts, 'Property Type'),
  };
}

/** Exact parent match scopes the list; empty or unknown parent keeps the full
 * catalog so custom parents never lock the child blank. */
export function scopedSuggestionOptions(
  all: readonly string[],
  byParent: Record<string, string[]>,
  parentValue: string,
): string[] {
  const key = parentValue.trim();
  if (!key) return [...all];
  const scoped = byParent[key];
  return scoped ? [...scoped] : [...all];
}

/** Resolves combobox options for a column given the current parent drafts. */
export function suggestionOptionsForColumn(
  column: string,
  suggestions: SearchSuggestions,
  dependencies: SearchSuggestionDependencies,
  parents: SuggestionParentValues,
): string[] {
  switch (column) {
    case 'Property City':
      return scopedSuggestionOptions(
        suggestions['Property City'] ?? [],
        dependencies.citiesByState,
        parents.state,
      );
    case 'Property County':
      return scopedSuggestionOptions(
        suggestions['Property County'] ?? [],
        dependencies.countiesByState,
        parents.state,
      );
    case 'Market':
      return scopedSuggestionOptions(
        suggestions.Market ?? [],
        dependencies.marketsByState,
        parents.state,
      );
    case 'Submarket Name': {
      const all = suggestions['Submarket Name'] ?? [];
      const market = parents.market.trim();
      if (market) {
        return scopedSuggestionOptions(all, dependencies.submarketsByMarket, market);
      }
      // Market empty but State set: union of submarkets under that state's markets.
      const state = parents.state.trim();
      if (state && dependencies.marketsByState[state]) {
        const union = new Set<string>();
        for (const stateMarket of dependencies.marketsByState[state]) {
          for (const submarket of dependencies.submarketsByMarket[stateMarket] ?? []) {
            union.add(submarket);
          }
        }
        return [...union].sort((a, b) => a.localeCompare(b));
      }
      return [...all];
    }
    case 'Secondary Type':
      return scopedSuggestionOptions(
        suggestions['Secondary Type'] ?? [],
        dependencies.secondaryTypesByPropertyType,
        parents.propertyType,
      );
    case 'Proposed Use':
      return scopedSuggestionOptions(
        suggestions['Proposed Use'] ?? [],
        dependencies.proposedUsesByPropertyType,
        parents.propertyType,
      );
    default:
      return isSearchSuggestionColumn(column) ? [...(suggestions[column] ?? [])] : [];
  }
}

const DEPENDENT_CHILD_COLUMNS = [
  'Property City',
  'Property County',
  'Market',
  'Submarket Name',
  'Secondary Type',
  'Proposed Use',
] as const;

function dependencyMapForChild(
  column: (typeof DEPENDENT_CHILD_COLUMNS)[number],
  dependencies: SearchSuggestionDependencies,
): Record<string, string[]> {
  switch (column) {
    case 'Property City':
      return dependencies.citiesByState;
    case 'Property County':
      return dependencies.countiesByState;
    case 'Market':
      return dependencies.marketsByState;
    case 'Submarket Name':
      return dependencies.submarketsByMarket;
    case 'Secondary Type':
      return dependencies.secondaryTypesByPropertyType;
    case 'Proposed Use':
      return dependencies.proposedUsesByPropertyType;
    default: {
      const _exhaustive: never = column;
      return _exhaustive;
    }
  }
}

function childIsScoped(
  child: (typeof DEPENDENT_CHILD_COLUMNS)[number],
  parents: SuggestionParentValues,
  dependencies: SearchSuggestionDependencies,
): boolean {
  switch (child) {
    case 'Property City':
    case 'Property County':
    case 'Market':
      return parents.state.trim() !== ''
        && dependencyMapForChild(child, dependencies)[parents.state.trim()] != null;
    case 'Submarket Name': {
      const market = parents.market.trim();
      if (market) return dependencies.submarketsByMarket[market] != null;
      const state = parents.state.trim();
      return state !== '' && dependencies.marketsByState[state] != null;
    }
    case 'Secondary Type':
    case 'Proposed Use':
      return parents.propertyType.trim() !== ''
        && dependencyMapForChild(child, dependencies)[parents.propertyType.trim()] != null;
    default: {
      const _exhaustive: never = child;
      return _exhaustive;
    }
  }
}

/** Clears child drafts that are no longer among the scoped options for their
 * parent, so the sheet cannot hold an impossible pair. Runs a few passes so a
 * cleared Market can cascade into Submarket in the same edit. */
export function reconcileDependentDrafts(
  drafts: DraftFieldFilter[],
  suggestions: SearchSuggestions,
  dependencies: SearchSuggestionDependencies,
): DraftFieldFilter[] {
  let current = drafts;
  for (let pass = 0; pass < DEPENDENT_CHILD_COLUMNS.length; pass++) {
    const parents = suggestionParentValues(current);
    const next = current.map(draft => {
      if (draft.kind !== 'text' || !draft.contains.trim()) return draft;
      if (!(DEPENDENT_CHILD_COLUMNS as readonly string[]).includes(draft.column)) return draft;
      const child = draft.column as (typeof DEPENDENT_CHILD_COLUMNS)[number];
      if (!childIsScoped(child, parents, dependencies)) return draft;
      const allowed = new Set(
        suggestionOptionsForColumn(child, suggestions, dependencies, parents),
      );
      if (allowed.has(draft.contains)) return draft;
      return { ...draft, contains: '' };
    });
    const changed = next.some((draft, index) => draft !== current[index]);
    current = next;
    if (!changed) break;
  }
  return current;
}

/** Catalog headers laid out on the search sheet, in arrangement order. */
export function searchSheetColumns(pages: readonly RecordDisplayPage[]): string[] {
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    for (const item of page.items) {
      if (item.kind !== 'field') continue;
      if (seen.has(item.column.key)) continue;
      seen.add(item.column.key);
      columns.push(item.column.key);
    }
  }
  return columns;
}

function draftIsEmpty(draft: DraftFieldFilter): boolean {
  switch (draft.kind) {
    case 'text':
      return !draft.contains.trim();
    case 'number':
      return !draft.min.trim() && !draft.max.trim();
    case 'date':
      return !draft.from && !draft.to;
    case 'boolean':
      return draft.value === '';
    default: {
      const _exhaustive: never = draft;
      return _exhaustive;
    }
  }
}

function overlayText(byColumn: Map<string, DraftFieldFilter>, column: string, value: string) {
  const current = byColumn.get(column);
  if (!current || current.kind !== 'text' || !draftIsEmpty(current)) return;
  byColumn.set(column, { column, kind: 'text', contains: value });
}

function overlayNumber(
  byColumn: Map<string, DraftFieldFilter>,
  column: string,
  min?: number,
  max?: number,
) {
  const current = byColumn.get(column);
  if (!current || current.kind !== 'number' || !draftIsEmpty(current)) return;
  if (min == null && max == null) return;
  byColumn.set(column, {
    column,
    kind: 'number',
    min: min != null ? String(min) : '',
    max: max != null ? String(max) : '',
  });
}

function overlayDate(
  byColumn: Map<string, DraftFieldFilter>,
  column: string,
  from?: string,
  to?: string,
) {
  const current = byColumn.get(column);
  if (!current || current.kind !== 'date' || !draftIsEmpty(current)) return;
  if (!from && !to) return;
  byColumn.set(column, {
    column,
    kind: 'date',
    from: from ?? '',
    to: to ?? '',
  });
}

/** Seeds one draft per arranged column from URL state. Explicit `fieldFilters`
 * win; legacy primary-filter params fill matching blanks so old links still
 * paint the sheet. */
export function draftsFromSearchFilters(
  filters: LandSaleFilters,
  columns: readonly string[],
): DraftFieldFilter[] {
  const byColumn = new Map<string, DraftFieldFilter>();
  for (const column of columns) {
    byColumn.set(column, emptyDraftFilter(column));
  }

  for (const draft of appliedToDraft(filters.fieldFilters ?? [])) {
    if (!byColumn.has(draft.column)) continue;
    byColumn.set(draft.column, draft);
  }

  if (filters.state) overlayText(byColumn, 'Property State', filters.state);
  if (filters.market) overlayText(byColumn, 'Market', filters.market);
  if (filters.county) overlayText(byColumn, 'Property County', filters.county);
  if (filters.city) overlayText(byColumn, 'Property City', filters.city);
  if (filters.types.length === 1) overlayText(byColumn, 'Secondary Type', filters.types[0]);
  if (filters.proposedUses.length === 1) {
    overlayText(byColumn, 'Proposed Use', filters.proposedUses[0]);
  }
  overlayNumber(byColumn, 'Land Area SF', filters.sfMin, filters.sfMax);
  overlayNumber(byColumn, 'Land Area AC', filters.acMin, filters.acMax);
  overlayNumber(byColumn, 'Building SF', filters.buildingSfMin, filters.buildingSfMax);

  if (filters.time?.mode === 'range') {
    overlayDate(byColumn, 'Sale Date', filters.time.from, filters.time.to);
  } else if (filters.time?.mode === 'last') {
    const from = lastDurationToDate(filters.time.duration, filters.time.unit);
    if (from) overlayDate(byColumn, 'Sale Date', from, undefined);
  }

  return columns.map(column => byColumn.get(column) ?? emptyDraftFilter(column));
}

function lastDurationToDate(duration: number, unit: 'months' | 'years'): string | null {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const d = new Date();
  if (unit === 'months') d.setMonth(d.getMonth() - duration);
  else d.setFullYear(d.getFullYear() - duration);
  return d.toISOString().slice(0, 10);
}

/** Search submit drops the wizard's primary params; arranged fields speak only
 * through `fieldFilters`, which the results sidebar already edits. */
export function filtersFromSearchSheet(fieldFilters: FieldFilter[]): LandSaleFilters {
  return {
    types: [],
    proposedUses: [],
    fieldFilters,
  };
}

export function searchControlHint(column: string): string {
  const kind = costarColumnType(column);
  switch (kind) {
    case 'text':
      return 'Contains';
    case 'number':
      return 'Min / max';
    case 'date':
      return 'From / to';
    case 'boolean':
      return 'Is';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
