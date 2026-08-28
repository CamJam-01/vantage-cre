import { encodeFilters, type LandSaleFilters } from './search-params';

export const PAGE_SIZE = 50;
export const MAX_PAGE = 1_000_000;

/** Total decoder: any missing or malformed value is page 1. Never throws. */
export function decodePage(input: unknown): number {
  const raw = Array.isArray(input) ? input[0] : input;
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 1 && raw <= MAX_PAGE ? raw : 1;
  }
  if (typeof raw !== 'string' || raw === '') return 1;
  if (!/^[0-9]+$/.test(raw)) return 1;
  const page = Number(raw);
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE) return 1;
  return page;
}

/** Page 1 is the default and is omitted from the URL. */
export function encodePage(page: number): string | null {
  if (!Number.isInteger(page) || page <= 1 || page > MAX_PAGE) return null;
  return String(page);
}

export function pageRange(page: number, pageSize: number = PAGE_SIZE): { from: number; to: number } {
  const safePage = Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
  const from = (safePage - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function lastPage(total: number, pageSize: number = PAGE_SIZE): number {
  if (!Number.isFinite(total) || total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function resultsRangeLabel(
  page: number,
  total: number,
  count: number,
  pageSize: number = PAGE_SIZE,
): string {
  if (total === 0) return 'showing 0 of 0';
  if (count === 0) return `showing 0 of ${total}`;
  const start = (page - 1) * pageSize + 1;
  const end = start + count - 1;
  return `showing ${start}–${end} of ${total}`;
}

export function landSalesPageHref(filters: LandSaleFilters, page: number): string {
  const params = encodeFilters(filters);
  const encoded = encodePage(page);
  if (encoded) params.set('page', encoded);
  const qs = params.toString();
  return qs ? `/land-sales?${qs}` : '/land-sales';
}
