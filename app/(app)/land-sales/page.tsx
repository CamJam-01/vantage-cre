import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { decodeFilters } from '@/lib/land-sales/search-params';
import { decodePage } from '@/lib/land-sales/pagination';
import { decodeSort } from '@/lib/land-sales/results-sort';
import { resultColumns } from '@/lib/land-sales/result-columns';
import { loadDisplaySettings } from '@/lib/land-sales/display-settings';
import { filterVisibleColumns, orderColumns, SALES_DATABASE_KEY } from '@/lib/land-sales/field-visibility';
import { canDelete, canEdit, getCurrentUserProfile } from '@/lib/users/roles';
import { ResultsToolbar } from '@/components/land-sales/results-table';
import { LandSalesResults, ResultsFallback } from './land-sales-results';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LandSalesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = decodeFilters(params);
  const page = decodePage(params.page);
  const sort = decodeSort(params.sort, params.dir);

  const supabase = await createClient();
  const [profile, display] = await Promise.all([
    getCurrentUserProfile(supabase),
    loadDisplaySettings(supabase, SALES_DATABASE_KEY),
  ]);
  const columns = orderColumns(resultColumns(), display.fieldOrder);
  const visibleColumns = filterVisibleColumns(columns, display.hidden);
  const role = profile?.role ?? 'Viewer';
  const active = Boolean(profile && !profile.is_suspended);

  return (
    <>
      <ResultsToolbar
        columns={visibleColumns}
        canEdit={active && canEdit(role)}
        canDelete={active && canDelete(role)}
        filters={filters}
        sort={sort}
      />
      <Suspense fallback={<ResultsFallback />}>
        <LandSalesResults
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
