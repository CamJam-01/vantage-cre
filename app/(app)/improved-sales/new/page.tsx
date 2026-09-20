import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canEdit, getCurrentUserProfile } from '@/lib/users/roles';
import { LandSaleForm } from '@/components/land-sales/land-sale-form';
import { loadDisplaySettings } from '@/lib/land-sales/display-settings';
import { IMPROVED_SALES_PATH } from '@/lib/land-sales/sales-path';

export default async function NewImprovedSalePage() {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile || profile.is_suspended || !canEdit(profile.role)) redirect(IMPROVED_SALES_PATH.basePath);

  const display = await loadDisplaySettings(supabase, IMPROVED_SALES_PATH.databaseKey);

  return (
    <LandSaleForm
      path={IMPROVED_SALES_PATH}
      hiddenFieldIds={[...display.hidden]}
      fieldOrder={display.fieldOrder}
      fieldDividers={display.fieldDividers}
    />
  );
}
