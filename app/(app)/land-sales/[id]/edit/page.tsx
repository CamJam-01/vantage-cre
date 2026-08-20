import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canEdit, getCurrentUserProfile } from '@/lib/users/roles';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function EditLandSalePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);

  if (!profile || !canEdit(profile.role)) {
    redirect(from ? `/land-sales/${id}?${qs.toString()}` : `/land-sales/${id}`);
  }

  qs.set('edit', '1');
  redirect(`/land-sales/${id}?${qs.toString()}`);
}
