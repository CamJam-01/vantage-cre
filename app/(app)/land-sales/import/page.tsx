import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canEdit, getCurrentUserProfile } from '@/lib/users/roles';
import { ImportLandSalesClient } from '@/components/land-sales/import-client';

export default async function ImportLandSalesPage() {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile || !canEdit(profile.role)) redirect('/land-sales');
  return <ImportLandSalesClient />;
}
