import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { decodeFilters } from '@/lib/land-sales/search-params';
import { applyLandSaleFilters } from '@/lib/land-sales/query';
import { ResultsTable } from '@/components/land-sales/results-table';
import type { LandSale } from '@/lib/land-sales/schema';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LandSalesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = decodeFilters(params);

  const supabase = await createClient();
  const { data, error } = await applyLandSaleFilters(supabase, filters);
  if (error) throw new Error(error.message);
  const records = (data ?? []) as LandSale[];

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) calc(var(--space-8) * 3)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-100)',
    }}>
      <div style={{ width: '100%', maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: '0 0 var(--space-1)' }}>
              Land Sales Results
            </h1>
            <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: 0 }}>
              {records.length} record{records.length === 1 ? '' : 's'} matching your search criteria
            </p>
          </div>
          <Link href="/search/sales/land" className="btn btn-ghost">Modify Search</Link>
        </div>

        <ResultsTable records={records} />
      </div>

      <Link href="/search/sales/land" className="blueprint" style={{
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
