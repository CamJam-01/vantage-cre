import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ResultsTable } from '@/components/land-sales/results-table';
import { applyLandSaleFilters, isUnsatisfiableRangeError } from '@/lib/land-sales/query';
import { landSaleFromRow, projectVisibleLandSale } from '@/lib/land-sales/db';
import { landSalesPageHref, lastPage, pageRange } from '@/lib/land-sales/pagination';
import type { LandSaleFilters } from '@/lib/land-sales/search-params';
import type { LandSalesPageData } from '@/lib/land-sales/results-page';
import type { ResultColumn } from '@/lib/land-sales/result-columns';
import type { ResultsSort } from '@/lib/land-sales/results-sort';

export async function loadLandSalesPage(
  filters: LandSaleFilters,
  page: number,
  visibleKeys: readonly string[],
  sort: ResultsSort,
): Promise<LandSalesPageData> {
  const supabase = await createClient();
  const { from, to } = pageRange(page);
  const fetched = await applyLandSaleFilters(supabase, filters, { from, to }, sort);
  let data = fetched.data;
  let count = fetched.count;
  if (fetched.error) {
    if (!isUnsatisfiableRangeError(fetched.error)) throw new Error(fetched.error.message);
    const counted = await applyLandSaleFilters(supabase, filters, { head: true }, sort);
    if (counted.error) throw new Error(counted.error.message);
    data = [];
    count = counted.count ?? 0;
  }
  const visible = new Set(visibleKeys);
  const records = (data ?? []).flatMap(row => {
    const record = landSaleFromRow(row as Record<string, unknown>);
    return record ? [projectVisibleLandSale(record, visible)] : [];
  });
  return { records, totalCount: count ?? 0 };
}

export function ResultsFallback() {
  return (
    <main style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-8) var(--space-6)',
      boxSizing: 'border-box',
      background: 'var(--color-accent-2-100)',
    }}>
      <p style={{ color: 'var(--color-neutral-600)' }}>Loading results…</p>
    </main>
  );
}

/** Streams the data-dependent result region after the toolbar has painted.
 * Hand-edited pages beyond the result set are canonicalized to the last page. */
export async function LandSalesResults({
  filters,
  page,
  sort,
  columns,
  canEdit,
}: {
  filters: LandSaleFilters;
  page: number;
  sort: ResultsSort;
  columns: ResultColumn[];
  canEdit: boolean;
}) {
  const result = await loadLandSalesPage(filters, page, columns.map(column => column.key), sort);
  const finalPage = lastPage(result.totalCount);
  if (page > finalPage) redirect(landSalesPageHref(filters, finalPage, sort));

  return (
    <ResultsTable
      records={result.records}
      totalCount={result.totalCount}
      page={page}
      columns={columns}
      canEdit={canEdit}
      filters={filters}
      sort={sort}
    />
  );
}
