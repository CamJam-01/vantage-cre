import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/users/roles';
import { Blueprint } from '@/components/ui/blueprint';
import { FieldVisibilityForm } from '@/components/admin/field-visibility-form';
import { DATABASE_CATEGORIES } from '@/lib/admin/database-descriptor';
import { resultColumns } from '@/lib/land-sales/result-columns';
import { loadDisplaySettings } from '@/lib/land-sales/display-settings';
import { SALES_DATABASE_KEY, type FieldDivider } from '@/lib/land-sales/field-visibility';

type PageProps = { searchParams: Promise<{ db?: string }> };

export default async function DatabaseFieldsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile) redirect('/login');
  if (profile.role !== 'Admin') redirect('/search');

  const { db } = await searchParams;
  const category = DATABASE_CATEGORIES.find(c => c.key === db);
  if (!category || !category.available) redirect('/admin/database-manager');

  const settings = await loadDisplaySettings(supabase, SALES_DATABASE_KEY)
    .then(loaded => ({ ...loaded, error: null as string | null }))
    .catch((error: unknown) => ({
      hidden: new Set<string>(),
      fieldOrder: [] as string[],
      fieldDividers: [] as FieldDivider[],
      error: error instanceof Error ? error.message : 'Could not load field visibility.',
    }));
  const columns = resultColumns();
  const disabledReason = settings.error ?? undefined;

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) calc(var(--space-8) * 3)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-200)',
    }}>
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div>
          <div className="tag tag-outline" style={{ marginBottom: 'var(--space-2)' }}>DATABASE MANAGER</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: 0 }}>
            Field configuration
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: 'var(--space-2) 0 0' }}>
            Choose which fields every user sees — and the order they appear in — across results,
            record details, editing, and manual entry.
            Stored data and CSV imports and exports are not changed.
          </p>
        </div>

        <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', padding: 'var(--space-6)', background: 'var(--color-neutral-100)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
            {category.name}
          </div>
          <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: '0 0 var(--space-4)' }}>
            This is one global display configuration for the selected table. Hidden fields keep their data and remain available to CSV workflows.
          </p>
          <FieldVisibilityForm
            databaseKey={SALES_DATABASE_KEY}
            columns={columns}
            initialHiddenFieldIds={[...settings.hidden]}
            initialFieldOrder={settings.fieldOrder}
            initialFieldDividers={settings.fieldDividers}
            disabledReason={disabledReason}
          />
        </Blueprint>
      </div>
    </main>
  );
}
