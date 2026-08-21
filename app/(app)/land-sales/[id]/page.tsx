import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RecordDetails } from '@/components/land-sales/record-details';
import type { LandSale } from '@/lib/land-sales/schema';
import { canEdit, getCurrentUserProfile } from '@/lib/users/roles';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; edit?: string }>;
};

export default async function RecordDetailsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { from, edit } = await searchParams;
  const supabase = await createClient();
  const [{ data: record, error }, profile] = await Promise.all([
    supabase.from('land_sales').select('*').eq('id', id).maybeSingle(),
    getCurrentUserProfile(supabase),
  ]);
  if (error) throw new Error(error.message);
  if (!record) notFound();
  const r = {
    ...(record as LandSale),
    extras: (record as LandSale).extras ?? {},
  };
  const editable = canEdit(profile?.role ?? 'Viewer');

  return (
    <RecordDetails
      record={r}
      from={from}
      canEdit={editable}
      startEditing={edit === '1' && editable}
    />
  );
}
