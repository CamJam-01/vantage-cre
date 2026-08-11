import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Blueprint } from '@/components/ui/blueprint';
import { formatCurrency, formatDate, formatNumber } from '@/lib/land-sales/format';
import type { LandSale } from '@/lib/land-sales/schema';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, letterSpacing: '0.05em', color: 'var(--color-neutral-700)', textTransform: 'uppercase', marginBottom: 'var(--space-1)' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>{value}</div>
    </div>
  );
}

export default async function RecordDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: record, error } = await supabase.from('land_sales').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!record) notFound();
  const r = record as LandSale;

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) calc(var(--space-8) * 3)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-100)',
    }}>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div className="tag tag-outline" style={{ marginBottom: 'var(--space-2)' }}>{r.parcel_id || r.id}</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: 0 }}>
            {r.address || `${r.city}, ${r.state}`}
          </h1>
          <p style={{ fontSize: 15, color: 'var(--color-neutral-700)', margin: 'var(--space-1) 0 0' }}>
            {r.city}, {r.state} · {r.county} County
          </p>
        </div>

        <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', padding: 'var(--space-6)', background: '#FFFFFF' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            <Field label="Sale Date" value={formatDate(r.sale_date)} />
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

      <Link href="/land-sales" className="blueprint" style={{
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
