import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canEdit, getCurrentUserProfile } from '@/lib/users/roles';
import { ImportLandSalesClient } from '@/components/land-sales/import-client';
import { IMPROVED_SALES_PATH } from '@/lib/land-sales/sales-path';

export default async function ImportImprovedSalesPage() {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile || !canEdit(profile.role)) redirect(IMPROVED_SALES_PATH.basePath);
  return <ImportLandSalesClient path={IMPROVED_SALES_PATH} />;
}
