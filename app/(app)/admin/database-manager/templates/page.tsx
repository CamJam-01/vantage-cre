import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/users/roles';
import { DATABASE_CATEGORIES } from '@/lib/admin/database-descriptor';
import { listDocxTemplates } from '@/lib/land-sales/docx-template-store';
import { mergeTagCatalog } from '@/lib/land-sales/merge-tags';
import { DocxTemplatesManager } from '@/components/admin/docx-templates-manager';
import type { DocxTemplate } from '@/lib/land-sales/docx-templates';

type PageProps = { searchParams: Promise<{ db?: string }> };

export default async function DatabaseTemplatesPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile) redirect('/login');
  if (profile.role !== 'Admin') redirect('/search');

  const { db } = await searchParams;
  const category = DATABASE_CATEGORIES.find(c => c.key === db);
  if (!category || !category.available) redirect('/admin/database-manager');

  const { templates, loadError } = await listDocxTemplates(supabase)
    .then(loaded => ({ templates: loaded, loadError: undefined as string | undefined }))
    .catch((error: unknown) => ({
      templates: [] as DocxTemplate[],
      loadError: error instanceof Error ? error.message : 'Could not load merge templates.',
    }));

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
            Merge templates
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: 'var(--space-2) 0 0' }}>
            Word templates for {category.name}, available to everyone in <strong>Merge to DOCX</strong> on
            the results page.
            Selecting records there fills one copy of the chosen template per record, all in a single
            document with a page break between records. Tags in a header or footer belong to the
            document as a whole, so they fill from the first selected record.
          </p>
          <Link
            href="/admin/database-manager"
            className="btn btn-ghost"
            style={{ marginTop: 'var(--space-3)', display: 'inline-flex' }}
          >
            ← Back to Databases
          </Link>
        </div>

        <DocxTemplatesManager
          templates={templates}
          tags={mergeTagCatalog()}
          loadError={loadError}
        />
      </div>
    </main>
  );
}
