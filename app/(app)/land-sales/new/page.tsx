import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canEdit, getCurrentUserProfile } from '@/lib/users/roles';
import { LandSaleForm } from '@/components/land-sales/land-sale-form';

export default async function NewLandSalePage() {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile || !canEdit(profile.role)) redirect('/land-sales');
  return <LandSaleForm />;
}
