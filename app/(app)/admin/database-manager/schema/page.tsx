import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/users/roles';
import { Blueprint } from '@/components/ui/blueprint';
import { DATABASE_CATEGORIES, customFieldDescriptor, type FieldDescriptor } from '@/lib/admin/database-descriptor';

type PageProps = { searchParams: Promise<{ db?: string }> };

export default async function DatabaseSchemaPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile) redirect('/login');
  if (profile.role !== 'Admin') redirect('/search');

  const { db } = await searchParams;
  const category = DATABASE_CATEGORIES.find(c => c.key === db);
  if (!category || !category.available) redirect('/admin/database-manager');

  const { data: customRows, error: customError } = await supabase
    .from('land_sales_custom_fields')
    .select('label')
    .order('label');
  const fields: FieldDescriptor[] = customError
    ? []
    : (customRows ?? []).map(row => customFieldDescriptor(row.label as string));

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
            {category.name}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: 'var(--space-2) 0 0' }}>
            Columns are managed in Supabase. This app cannot add, edit, or delete table fields.
          </p>
        </div>

        <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', padding: 'var(--space-6)', background: 'var(--color-neutral-100)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
            Fields
          </div>
          {fields.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: 0 }}>
              No extra fields are catalogued here. Add or remove columns in the Supabase table editor.
            </p>
          ) : (
            <table className="table" style={{ width: '100%' }}>
              <thead><tr><th>Field Name</th><th>Type</th><th>Required</th><th>Visible in Search</th></tr></thead>
              <tbody>
                {fields.map(f => (
                  <tr key={f.name}>
                    <td>{f.name}</td>
                    <td>
                      {f.type}
                      {f.custom ? (
                        <span className="tag tag-neutral" style={{ marginLeft: 8 }}>Custom</span>
                      ) : null}
                    </td>
                    <td><span className={`tag ${f.required ? 'tag-accent' : 'tag-neutral'}`}>{f.required ? 'Required' : 'Optional'}</span></td>
                    <td><span className={`tag ${f.visibleInSearch ? 'tag-accent' : 'tag-neutral'}`}>{f.visibleInSearch ? 'Visible' : 'Hidden'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Blueprint>
      </div>
    </main>
  );
}
