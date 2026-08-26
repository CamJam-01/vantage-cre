import { createClient } from '@/lib/supabase/server';
import { getDistinctSecondaryTypes } from '@/lib/land-sales/query';
import { decodeFilters } from '@/lib/land-sales/search-params';
import { LandSalesSearchClient } from './search-client';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LandSalesSearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = decodeFilters(params);

  const supabase = await createClient();
  const secondaryTypes = await getDistinctSecondaryTypes(supabase);
  return <LandSalesSearchClient secondaryTypes={secondaryTypes} initial={filters} />;
}
