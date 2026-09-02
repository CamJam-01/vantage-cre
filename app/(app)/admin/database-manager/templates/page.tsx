import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/users/roles';
import { DATABASE_CATEGORIES } from '@/lib/admin/database-descriptor';
import { listDocxTemplates } from '@/lib/land-sales/docx-template-store';
import { mergeTagCatalog } from '@/lib/land-sales/merge-tags';
import { DocxTemplatesManager } from '@/components/admin/docx-templates-manager';
import type { DocxTemplate } from '@/lib/land-sales/docx-templates';
import { listDocxOutputFlows } from '@/lib/land-sales/output-flow-store';
import type { DocxOutputFlow } from '@/lib/land-sales/output-flows';

type PageProps = { searchParams: Promise<{ db?: string }> };

export default async function DatabaseTemplatesPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile) redirect('/login');
  if (profile.role !== 'Admin') redirect('/search');

  const { db } = await searchParams;
  const category = DATABASE_CATEGORIES.find(c => c.key === db);
  if (!category || !category.available) redirect('/admin/database-manager');

  const [templateResult, flowResult] = await Promise.all([
    listDocxTemplates(supabase)
      .then(templates => ({ templates, loadError: undefined as string | undefined }))
      .catch((error: unknown) => ({
        templates: [] as DocxTemplate[],
        loadError: error instanceof Error ? error.message : 'Could not load merge templates.',
      })),
    listDocxOutputFlows(supabase)
      .then(flows => ({ flows, flowLoadError: undefined as string | undefined }))
      .catch((error: unknown) => ({
        flows: [] as DocxOutputFlow[],
        flowLoadError: error instanceof Error ? error.message : 'Could not load output flows.',
      })),
  ]);

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
            Word templates and Output Flows for {category.name}. Users choose one named output on the
            results page; its router selects a template for each record and returns one document in
            selection order. Package-wide headers and footers come from the flow&apos;s default template.
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
          templates={templateResult.templates}
          flows={flowResult.flows}
          tags={mergeTagCatalog()}
          loadError={templateResult.loadError}
          flowLoadError={flowResult.flowLoadError}
        />
      </div>
    </main>
  );
}
