import { createClient } from '@/lib/supabase/server';
import { applyLandSaleFilters, isUnsatisfiableRangeError } from '@/lib/land-sales/query';
import { landSaleFromRow, projectVisibleLandSale } from '@/lib/land-sales/db';
import { pageRange } from '@/lib/land-sales/pagination';
import type { LandSaleFilters } from '@/lib/land-sales/search-params';
import type { LandSalesPageData } from '@/lib/land-sales/results-page';

export async function loadLandSalesPage(
  filters: LandSaleFilters,
  page: number,
  visibleKeys: readonly string[],
): Promise<LandSalesPageData> {
  const supabase = await createClient();
  const { from, to } = pageRange(page);
  const fetched = await applyLandSaleFilters(supabase, filters, { from, to });
  let data = fetched.data;
  let count = fetched.count;
  if (fetched.error) {
    if (!isUnsatisfiableRangeError(fetched.error)) throw new Error(fetched.error.message);
    const counted = await applyLandSaleFilters(supabase, filters, { head: true });
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
