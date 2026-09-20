import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ResultsTable, ResultsToolbar } from '@/components/land-sales/results-table';
import { applyLandSaleFilters, isUnsatisfiableRangeError } from '@/lib/land-sales/query';
import { landSaleFromRow, projectVisibleLandSale } from '@/lib/land-sales/db';
import { decodePage, landSalesPageHref, lastPage, pageRange } from '@/lib/land-sales/pagination';
import { decodeFilters, type LandSaleFilters } from '@/lib/land-sales/search-params';
import type { LandSalesPageData } from '@/lib/land-sales/results-page';
import { resultColumns, type ResultColumn } from '@/lib/land-sales/result-columns';
import { decodeSort, type ResultsSort } from '@/lib/land-sales/results-sort';
import { loadDisplaySettings } from '@/lib/land-sales/display-settings';
import { filterVisibleColumns, orderColumns } from '@/lib/land-sales/field-visibility';
import { canDelete, canEdit, getCurrentUserProfile } from '@/lib/users/roles';
import { listDocxOutputFlows } from '@/lib/land-sales/output-flow-store';
import type { DocxOutputFlow } from '@/lib/land-sales/output-flows';
import type { SalesPath } from '@/lib/land-sales/sales-path';

export async function loadLandSalesPage(
  path: SalesPath,
  filters: LandSaleFilters,
  page: number,
  visibleKeys: readonly string[],
  sort: ResultsSort,
): Promise<LandSalesPageData> {
  const supabase = await createClient();
  const { from, to } = pageRange(page);
  const fetched = await applyLandSaleFilters(supabase, filters, { from, to }, sort, path.table);
  let data = fetched.data;
  let count = fetched.count;
  if (fetched.error) {
    if (!isUnsatisfiableRangeError(fetched.error)) throw new Error(fetched.error.message);
    const counted = await applyLandSaleFilters(supabase, filters, { head: true }, sort, path.table);
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
  path,
  filters,
  page,
  sort,
  columns,
  canEdit,
}: {
  path: SalesPath;
  filters: LandSaleFilters;
  page: number;
  sort: ResultsSort;
  columns: ResultColumn[];
  canEdit: boolean;
}) {
  const result = await loadLandSalesPage(path, filters, page, columns.map(column => column.key), sort);
  const finalPage = lastPage(result.totalCount);
  if (page > finalPage) redirect(landSalesPageHref(filters, finalPage, sort, path.basePath));

  return (
    <ResultsTable
      path={path}
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

export async function SalesResultsPage({
  path,
  searchParams,
}: {
  path: SalesPath;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = decodeFilters(params);
  const page = decodePage(params.page);
  const sort = decodeSort(params.sort, params.dir);

  const supabase = await createClient();
  const [profile, display, outputFlows] = await Promise.all([
    getCurrentUserProfile(supabase),
    loadDisplaySettings(supabase, path.databaseKey),
    listDocxOutputFlows(supabase, path.databaseKey).catch(() => [] as DocxOutputFlow[]),
  ]);
  const columns = orderColumns(resultColumns(), display.fieldOrder);
  const visibleColumns = filterVisibleColumns(columns, display.hidden);
  const role = profile?.role ?? 'Viewer';
  const active = Boolean(profile && !profile.is_suspended);

  return (
    <>
      <ResultsToolbar
        path={path}
        columns={visibleColumns}
        canEdit={active && canEdit(role)}
        canDelete={active && canDelete(role)}
        filters={filters}
        sort={sort}
        outputFlows={outputFlows}
      />
      <Suspense fallback={<ResultsFallback />}>
        <LandSalesResults
          path={path}
          filters={filters}
          page={page}
          sort={sort}
          columns={visibleColumns}
          canEdit={active && canEdit(role)}
        />
      </Suspense>
    </>
  );
}
