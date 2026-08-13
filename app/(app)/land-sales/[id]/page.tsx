import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Blueprint } from '@/components/ui/blueprint';
import { formatCurrency, formatDate, formatNumber } from '@/lib/land-sales/format';
import type { LandSale } from '@/lib/land-sales/schema';
import { canEdit, getCurrentUserProfile } from '@/lib/users/roles';

function Field({ label, value, warning }: { label: string; value: string; warning?: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, letterSpacing: '0.05em', color: 'var(--color-neutral-700)', textTransform: 'uppercase', marginBottom: 'var(--space-1)' }}>
        {label}
      </div>
      {warning ? (
        <div title={warning} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 18, fontWeight: 600, color: '#92400e' }}>
          <TriangleAlert size={16} strokeWidth={2} />
          {value}
        </div>
      ) : (
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>{value}</div>
      )}
    </div>
  );
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function RecordDetailsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const supabase = await createClient();
  const [{ data: record, error }, profile] = await Promise.all([
    supabase.from('land_sales').select('*').eq('id', id).maybeSingle(),
    getCurrentUserProfile(supabase),
  ]);
  if (error) throw new Error(error.message);
  if (!record) notFound();
  const r = record as LandSale;

  const backToSearchHref = from ? `/land-sales?${from}` : '/land-sales';
  const editHref = from ? `/land-sales/${r.id}/edit?from=${encodeURIComponent(from)}` : `/land-sales/${r.id}/edit`;

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) calc(var(--space-8) * 3)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-200)',
    }}>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <Link href={backToSearchHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-4)' }}>
          <ArrowLeft size={16} strokeWidth={2} />
          Back to search
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div>
            <div className="tag tag-outline" style={{ marginBottom: 'var(--space-2)' }}>{r.parcel_id || r.id}</div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: 0 }}>
              {r.address || `${r.city}, ${r.state}`}
            </h1>
            <p style={{ fontSize: 15, color: 'var(--color-neutral-700)', margin: 'var(--space-1) 0 0' }}>
              {r.city}, {r.state} · {r.county} County
            </p>
          </div>
          {canEdit(profile?.role ?? 'Viewer') && (
            <Link href={editHref} className="btn btn-ghost">Edit</Link>
          )}
        </div>

        <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', padding: 'var(--space-6)', background: 'var(--color-neutral-100)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            <Field
              label="Sale Date"
              value={r.sale_date ? formatDate(r.sale_date) : r.sale_date_raw ? r.sale_date_raw : '—'}
              warning={!r.sale_date && r.sale_date_raw ? `Unrecognized date from import: "${r.sale_date_raw}". Flagged for review.` : undefined}
            />
            <Field label="Sale Price" value={formatCurrency(r.sale_price)} />
            <Field label="Acreage" value={r.acreage != null ? `${formatNumber(r.acreage)} AC` : '—'} />
            <Field label="Price / Acre" value={formatCurrency(r.price_per_acre)} />
            <Field label="Square Feet" value={r.square_feet != null ? `${formatNumber(r.square_feet)} SF` : '—'} />
            <Field label="Property Type" value={r.property_type} />
            <Field label="Buyer" value={r.buyer || '—'} />
            <Field label="Parcel ID" value={r.parcel_id || '—'} />
            <Field label="MSA" value={r.msa || '—'} />
          </div>
        </Blueprint>
      </div>
    </main>
  );
}
