import { createClient } from '@/lib/supabase/server';
import { loadDisplaySettings } from '@/lib/land-sales/display-settings';
import {
  buildRecordDisplayPages,
  fieldDisplayRows,
} from '@/lib/land-sales/field-visibility';
import {
  loadSearchSuggestionDependencies,
  loadSearchSuggestions,
} from '@/lib/land-sales/query';
import { resultColumns } from '@/lib/land-sales/result-columns';
import { decodeFilters } from '@/lib/land-sales/search-params';
import { LAND_SALES_PATH } from '@/lib/land-sales/sales-path';
import { LandSalesSearchSheetClient } from './search-sheet-client';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LandSalesSearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = decodeFilters(params);
  const supabase = await createClient();
  const [display, suggestions, suggestionDependencies] = await Promise.all([
    loadDisplaySettings(supabase, LAND_SALES_PATH.databaseKey),
    loadSearchSuggestions(supabase, LAND_SALES_PATH.table),
    loadSearchSuggestionDependencies(supabase, LAND_SALES_PATH.table),
  ]);
  const rows = fieldDisplayRows(
    resultColumns({ pathId: LAND_SALES_PATH.id }),
    display.fieldOrder,
    display.fieldDividers,
  );
  const pages = buildRecordDisplayPages(rows, display.hidden);

  return (
    <LandSalesSearchSheetClient
      path={LAND_SALES_PATH}
      pages={pages}
      initial={filters}
      suggestions={suggestions}
      suggestionDependencies={suggestionDependencies}
    />
  );
}
