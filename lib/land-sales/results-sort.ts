import { costarColumnNames } from './costar-fields';

export type ResultsSortDir = 'asc' | 'desc';

export type ResultsSort = {
  column: string;
  dir: ResultsSortDir;
};

/** Newest first, matching the results query before anyone clicks a header.
 * Kept out of `LandSaleFilters` for the same reason as `page`: a sort is
 * presentation of a result set, not a filter, and must not increment the
 * "N active" badge. */
export const DEFAULT_RESULTS_SORT: ResultsSort = { column: 'Sale Date', dir: 'desc' };

const SORTABLE_COLUMNS = new Set(costarColumnNames());

function firstString(input: unknown): string | undefined {
  const raw = Array.isArray(input) ? input[0] : input;
  return typeof raw === 'string' ? raw : undefined;
}

/** Total decoder: unknown, hidden, or hand-edited columns fall back to the
 * default rather than throwing. A valid column with a missing/invalid dir
 * sorts ascending — the first header click. */
export function decodeSort(sortInput: unknown, dirInput: unknown): ResultsSort {
  const column = firstString(sortInput);
  if (!column || !SORTABLE_COLUMNS.has(column)) return DEFAULT_RESULTS_SORT;
  const dir = firstString(dirInput) === 'desc' ? 'desc' : 'asc';
  return { column, dir };
}

/** Default sort is omitted from the URL, like page 1. */
export function encodeSort(sort: ResultsSort): { column: string; dir: ResultsSortDir } | null {
  if (sort.column === DEFAULT_RESULTS_SORT.column && sort.dir === DEFAULT_RESULTS_SORT.dir) {
    return null;
  }
  if (!SORTABLE_COLUMNS.has(sort.column)) return null;
  return { column: sort.column, dir: sort.dir === 'desc' ? 'desc' : 'asc' };
}

export function appendSortParams(params: URLSearchParams, sort: ResultsSort): void {
  const encoded = encodeSort(sort);
  if (!encoded) return;
  params.set('sort', encoded.column);
  params.set('dir', encoded.dir);
}

export function toggleResultsSort(current: ResultsSort, column: string): ResultsSort {
  if (current.column === column) {
    return { column, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { column, dir: 'asc' };
}
