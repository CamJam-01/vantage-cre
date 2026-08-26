import { createClient } from '@/lib/supabase/server';
import { decodeFilters } from '@/lib/land-sales/search-params';
import { applyLandSaleFilters } from '@/lib/land-sales/query';
import { landSaleFromRow } from '@/lib/land-sales/db';
import { resultColumns } from '@/lib/land-sales/result-columns';
import { loadDisplaySettings } from '@/lib/land-sales/display-settings';
import { filterVisibleColumns, orderColumns, SALES_DATABASE_KEY } from '@/lib/land-sales/field-visibility';
import { ResultsTable } from '@/components/land-sales/results-table';
import { canEdit, getCurrentUserProfile } from '@/lib/users/roles';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LandSalesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = decodeFilters(params);

  const supabase = await createClient();
  const [{ data, error }, profile, display] = await Promise.all([
    applyLandSaleFilters(supabase, filters),
    getCurrentUserProfile(supabase),
    loadDisplaySettings(supabase, SALES_DATABASE_KEY),
  ]);
  if (error) throw new Error(error.message);
  const records = (data ?? []).map(row => landSaleFromRow(row as Record<string, unknown>));
  const catalogLabels: string[] = [];
  const columns = orderColumns(resultColumns({ catalogLabels }), display.fieldOrder);
  const visibleColumns = filterVisibleColumns(columns, display.hidden);

  return <ResultsTable records={records} columns={visibleColumns} canEdit={canEdit(profile?.role ?? 'Viewer')} filters={filters} />;
}
