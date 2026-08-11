'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Blueprint } from '@/components/ui/blueprint';
import { Button } from '@/components/ui/button';
import type { LandSale } from '@/lib/land-sales/schema';
import { formatCurrency, formatDate, formatNumber } from '@/lib/land-sales/format';
import { makeCsv, downloadCsv } from '@/lib/land-sales/csv';

export function ResultsTable({ records }: { records: LandSale[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleRow(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(prev => prev.size === records.length ? new Set() : new Set(records.map(r => r.id)));
  }

  const selectedCount = selectedIds.size;

  function viewDetails() {
    if (selectedCount !== 1) return;
    const [id] = selectedIds;
    router.push(`/land-sales/${id}`);
  }

  function exportCsv() {
    const selected = records.filter(r => selectedIds.has(r.id));
    if (!selected.length) return;
    downloadCsv('land-sales-export.csv', makeCsv(selected));
  }

  const selectionLabel = useMemo(() => (
    selectedCount === 0 ? 'No records selected' : `${selectedCount} record${selectedCount === 1 ? '' : 's'} selected`
  ), [selectedCount]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>{selectionLabel}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Button variant="secondary" onClick={viewDetails} disabled={selectedCount !== 1}>View Details</Button>
          <Button variant="secondary" onClick={exportCsv} disabled={selectedCount < 1}>Export CSV</Button>
          <Button variant="secondary" disabled title="Coming in a later phase">Merge to DOCX</Button>
          <Link href="/land-sales/import" className="btn btn-ghost">Import CSV</Link>
          <Link href="/land-sales/new" className="btn btn-ghost">+ Add Record</Link>
        </div>
      </div>

      <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', overflowX: 'auto', background: 'var(--color-accent-2-100)' }}>
        <table className="table" style={{ width: '100%', minWidth: 1100 }}>
          <thead style={{ background: 'var(--color-accent-2-200)' }}>
            <tr>
              <th style={{ width: 40 }}>
                <input type="checkbox" checked={records.length > 0 && selectedCount === records.length} onChange={toggleAll} aria-label="Select all rows" />
              </th>
              <th>Parcel ID</th>
              <th>Address</th>
              <th>City</th>
              <th>County</th>
              <th>State</th>
              <th>Type</th>
              <th>Sale Date</th>
              <th>Acreage</th>
              <th>Square Feet</th>
              <th>Sale Price</th>
              <th>Price / Acre</th>
              <th>Buyer</th>
            </tr>
          </thead>
          <tbody style={{ background: '#FFFFFF' }}>
            {records.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-neutral-600)' }}>
                  No records match your search criteria.
                </td>
              </tr>
            ) : records.map(r => {
              const isSelected = selectedIds.has(r.id);
              return (
                <tr
                  key={r.id}
                  onClick={() => toggleRow(r.id)}
                  style={{ background: isSelected ? 'var(--color-accent-100)' : undefined, cursor: 'pointer' }}
                >
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleRow(r.id)} aria-label={`Select ${r.parcel_id || r.address}`} />
                  </td>
                  <td>{r.parcel_id || '—'}</td>
                  <td>{r.address || '—'}</td>
                  <td>{r.city}</td>
                  <td>{r.county}</td>
                  <td>{r.state}</td>
                  <td>{r.property_type}</td>
                  <td>{formatDate(r.sale_date)}</td>
                  <td>{formatNumber(r.acreage)}</td>
                  <td>{formatNumber(r.square_feet)}</td>
                  <td>{formatCurrency(r.sale_price)}</td>
                  <td>{formatCurrency(r.price_per_acre)}</td>
                  <td>{r.buyer || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Blueprint>
    </>
  );
}
