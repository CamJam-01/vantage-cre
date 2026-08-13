import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/users/roles';
import { Blueprint } from '@/components/ui/blueprint';
import { DATABASE_CATEGORIES, LAND_SALES_FIELDS } from '@/lib/admin/database-descriptor';

type PageProps = { searchParams: Promise<{ db?: string }> };

export default async function DatabaseSchemaPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile) redirect('/login');
  if (profile.role !== 'Admin') redirect('/search');

  const { db } = await searchParams;
  const category = DATABASE_CATEGORIES.find(c => c.key === db);
  if (!category || !category.available) redirect('/admin/database-manager');

  const fields = LAND_SALES_FIELDS;

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) calc(var(--space-8) * 3)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-100)',
    }}>
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div>
          <div className="tag tag-outline" style={{ marginBottom: 'var(--space-2)' }}>DATABASE MANAGER</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: 0 }}>
            Schema — {category.name}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: 'var(--space-2) 0 0' }}>
            Read-only for now — live field editing is planned for a later phase.
          </p>
        </div>

        <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', background: 'var(--color-bg)', padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>Fields</div>
            <button type="button" className="btn btn-primary" disabled style={{ opacity: 0.45, cursor: 'not-allowed' }} title="Coming in a later phase">
              Add Field
            </button>
          </div>
          <table className="table" style={{ width: '100%' }}>
            <thead><tr><th>Field Name</th><th>Type</th><th>Required</th><th>Visible in Search</th><th></th></tr></thead>
            <tbody>
              {fields.map(f => (
                <tr key={f.name}>
                  <td>{f.name}</td>
                  <td>{f.type}</td>
                  <td><span className={`tag ${f.required ? 'tag-accent' : 'tag-neutral'}`}>{f.required ? 'Required' : 'Optional'}</span></td>
                  <td><span className={`tag ${f.visibleInSearch ? 'tag-accent' : 'tag-neutral'}`}>{f.visibleInSearch ? 'Visible' : 'Hidden'}</span></td>
                  <td style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button type="button" className="btn btn-ghost" disabled style={{ opacity: 0.45, cursor: 'not-allowed' }} title="Coming in a later phase">Edit</button>
                    <button type="button" className="btn btn-ghost" disabled style={{ opacity: 0.45, cursor: 'not-allowed' }} title="Coming in a later phase">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Blueprint>
      </div>

      <Link href="/admin/database-manager" className="blueprint" style={{
        position: 'fixed', bottom: 'var(--space-6)', left: 'var(--space-6)', display: 'flex',
        alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-6)',
        background: 'var(--color-bg)', color: 'var(--color-text)', boxShadow: 'var(--shadow-md)', textDecoration: 'none',
      }}>
        <ArrowLeft size={18} strokeWidth={2} />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, letterSpacing: '0.03em' }}>BACK</span>
      </Link>
    </main>
  );
}
