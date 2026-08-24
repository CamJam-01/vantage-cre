import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canEdit, getCurrentUserProfile } from '@/lib/users/roles';
import { LandSaleForm } from '@/components/land-sales/land-sale-form';
import { loadHiddenFieldIds } from '@/lib/land-sales/display-settings';
import { SALES_DATABASE_KEY } from '@/lib/land-sales/field-visibility';
import { resultColumns } from '@/lib/land-sales/result-columns';

export default async function NewLandSalePage() {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile || !canEdit(profile.role)) redirect('/land-sales');

  const hiddenFieldIds = await loadHiddenFieldIds(supabase, SALES_DATABASE_KEY);
  const catalogLabels: string[] = [];
  const columns = resultColumns({ catalogLabels });

  return <LandSaleForm columns={columns} hiddenFieldIds={[...hiddenFieldIds]} />;
}
