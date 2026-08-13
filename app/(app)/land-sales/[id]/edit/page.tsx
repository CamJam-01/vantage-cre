import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canEdit, getCurrentUserProfile } from '@/lib/users/roles';
import { LandSaleForm } from '@/components/land-sales/land-sale-form';
import type { LandSale } from '@/lib/land-sales/schema';

export default async function EditLandSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile || !canEdit(profile.role)) redirect(`/land-sales/${id}`);

  const { data: record, error } = await supabase.from('land_sales').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!record) notFound();

  return <LandSaleForm record={record as LandSale} />;
}
