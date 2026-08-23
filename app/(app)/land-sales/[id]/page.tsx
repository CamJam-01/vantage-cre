import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RecordDetails } from '@/components/land-sales/record-details';
import { landSaleFromRow } from '@/lib/land-sales/db';
import { canEdit, getCurrentUserProfile } from '@/lib/users/roles';
import { loadHiddenFieldIds } from '@/lib/land-sales/display-settings';
import { SALES_DATABASE_KEY } from '@/lib/land-sales/field-visibility';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; edit?: string }>;
};

export default async function RecordDetailsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { from, edit } = await searchParams;
  const supabase = await createClient();
  const [{ data: record, error }, profile, customFields, hiddenFieldIds] = await Promise.all([
    supabase.from('land_sales').select('*').eq('id', id).maybeSingle(),
    getCurrentUserProfile(supabase),
    supabase.from('land_sales_custom_fields').select('label').order('label'),
    loadHiddenFieldIds(supabase, SALES_DATABASE_KEY),
  ]);
  if (error) throw new Error(error.message);
  if (!record) notFound();
  const r = landSaleFromRow(record as Record<string, unknown>);
  const editable = canEdit(profile?.role ?? 'Viewer');
  const catalogLabels = customFields.error
    ? []
    : (customFields.data ?? []).map(row => row.label as string);

  return (
    <RecordDetails
      record={r}
      from={from}
      canEdit={editable}
      startEditing={edit === '1' && editable}
      catalogLabels={catalogLabels}
      hiddenFieldIds={[...hiddenFieldIds]}
    />
  );
}
