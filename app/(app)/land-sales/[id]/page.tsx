import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RecordDetails } from '@/components/land-sales/record-details';
import { landSaleFromRow } from '@/lib/land-sales/db';
import { canDelete, canEdit, getCurrentUserProfile } from '@/lib/users/roles';
import { loadDisplaySettings } from '@/lib/land-sales/display-settings';
import { SALES_DATABASE_KEY } from '@/lib/land-sales/field-visibility';
import { fetchAdjacentLandSaleIds } from '@/lib/land-sales/query';
import { decodeFilters } from '@/lib/land-sales/search-params';
import { decodeSort } from '@/lib/land-sales/results-sort';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function RecordDetailsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const supabase = await createClient();
  const [{ data: record, error }, profile, display] = await Promise.all([
    supabase.from('land_sales').select('*').eq('id', id).maybeSingle(),
    getCurrentUserProfile(supabase),
    loadDisplaySettings(supabase, SALES_DATABASE_KEY),
  ]);
  if (error) throw new Error(error.message);
  if (!record) notFound();
  const r = landSaleFromRow(record as Record<string, unknown>);
  if (!r) notFound();
  const role = profile?.role ?? 'Viewer';
  const active = Boolean(profile && !profile.is_suspended);
  const editable = active && canEdit(role);

  const resultsParams = new URLSearchParams(from ?? '');
  const filters = decodeFilters(resultsParams);
  const sort = decodeSort(resultsParams.get('sort'), resultsParams.get('dir'));
  const { prevId, nextId, position, total } = await fetchAdjacentLandSaleIds(
    supabase,
    filters,
    sort,
    r.id,
    r.columns[sort.column],
  );

  return (
    <RecordDetails
      record={r}
      from={from}
      canEdit={editable}
      canDelete={active && canDelete(role)}
      prevId={prevId}
      nextId={nextId}
      resultPosition={position}
      resultTotal={total}
      hiddenFieldIds={[...display.hidden]}
      fieldOrder={display.fieldOrder}
      fieldDividers={display.fieldDividers}
    />
  );
}
