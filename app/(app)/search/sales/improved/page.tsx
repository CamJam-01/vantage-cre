import { createClient } from '@/lib/supabase/server';
import { getDistinctProposedUses, getDistinctSecondaryTypes } from '@/lib/land-sales/query';
import { decodeFilters } from '@/lib/land-sales/search-params';
import { IMPROVED_SALES_PATH } from '@/lib/land-sales/sales-path';
import { LandSalesSearchClient } from '../land/search-client';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ImprovedSalesSearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = decodeFilters(params);
  const supabase = await createClient();
  const [secondaryTypes, proposedUses] = await Promise.all([
    getDistinctSecondaryTypes(supabase, IMPROVED_SALES_PATH.table),
    getDistinctProposedUses(supabase, IMPROVED_SALES_PATH.table),
  ]);
  return (
    <LandSalesSearchClient
      path={IMPROVED_SALES_PATH}
      secondaryTypes={secondaryTypes}
      proposedUses={proposedUses}
      initial={filters}
    />
  );
}
