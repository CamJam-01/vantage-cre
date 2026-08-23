import { createClient } from '@/lib/supabase/server';
import { decodeFilters } from '@/lib/land-sales/search-params';
import { applyLandSaleFilters } from '@/lib/land-sales/query';
import { resultColumns } from '@/lib/land-sales/result-columns';
import { loadHiddenFieldIds } from '@/lib/land-sales/display-settings';
import { filterVisibleColumns, SALES_DATABASE_KEY } from '@/lib/land-sales/field-visibility';
import { ResultsTable } from '@/components/land-sales/results-table';
import type { LandSale } from '@/lib/land-sales/schema';
import { canEdit, getCurrentUserProfile } from '@/lib/users/roles';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LandSalesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = decodeFilters(params);

  const supabase = await createClient();
  const [{ data, error }, profile, customFields, hiddenFieldIds] = await Promise.all([
    applyLandSaleFilters(supabase, filters),
    getCurrentUserProfile(supabase),
    supabase.from('land_sales_custom_fields').select('label').order('label'),
    loadHiddenFieldIds(supabase, SALES_DATABASE_KEY),
  ]);
  if (error) throw new Error(error.message);
  const records = (data ?? []) as LandSale[];
  const catalogLabels = customFields.error
    ? []
    : (customFields.data ?? []).map(row => row.label as string);
  const columns = resultColumns({ catalogLabels, records });
  const visibleColumns = filterVisibleColumns(columns, hiddenFieldIds);

  return <ResultsTable records={records} columns={visibleColumns} canEdit={canEdit(profile?.role ?? 'Viewer')} filters={filters} />;
}
