import { createClient } from '@/lib/supabase/server';
import { decodeFilters } from '@/lib/land-sales/search-params';
import { applyLandSaleFilters } from '@/lib/land-sales/query';
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
  const [{ data, error }, profile] = await Promise.all([
    applyLandSaleFilters(supabase, filters),
    getCurrentUserProfile(supabase),
  ]);
  if (error) throw new Error(error.message);
  const records = (data ?? []) as LandSale[];

  return <ResultsTable records={records} canEdit={canEdit(profile?.role ?? 'Viewer')} filters={filters} />;
}
