'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ChevronsUpDown, TriangleAlert } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';
import { Button } from '@/components/ui/button';
import type { LandSale } from '@/lib/land-sales/schema';
import { formatCurrency, formatDate, formatNumber } from '@/lib/land-sales/format';
import { makeCsv, downloadCsv } from '@/lib/land-sales/csv';

type SortKey = 'parcel_id' | 'address' | 'city' | 'county' | 'state' | 'property_type' | 'sale_date' | 'acreage' | 'square_feet' | 'sale_price' | 'price_per_acre' | 'buyer';
type Sort = { key: SortKey; dir: 'asc' | 'desc' };

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'parcel_id', label: 'Parcel ID' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'county', label: 'County' },
  { key: 'state', label: 'State' },
  { key: 'property_type', label: 'Type' },
  { key: 'sale_date', label: 'Sale Date' },
  { key: 'acreage', label: 'Acreage' },
  { key: 'square_feet', label: 'Square Feet' },
  { key: 'sale_price', label: 'Sale Price' },
  { key: 'price_per_acre', label: 'Price / Acre' },
  { key: 'buyer', label: 'Buyer' },
];

function SortableHeader({ column, sort, onSort }: { column: { key: SortKey; label: string }; sort: Sort | null; onSort: (key: SortKey) => void }) {
  const active = sort?.key === column.key;
  return (
    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => onSort(column.key)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {column.label}
        {active ? (
          sort.dir === 'asc' ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />
        ) : (
          <ChevronsUpDown size={12} strokeWidth={2} style={{ opacity: 0.35 }} />
        )}
      </span>
    </th>
  );
}

export function ResultsTable({ records, canEdit }: { records: LandSale[]; canEdit: boolean }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort | null>(null);

  function handleSort(key: SortKey) {
    setSort(prev => (prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  const sortedRecords = useMemo(() => {
    if (!sort) return records;
    const { key, dir } = sort;
    const factor = dir === 'asc' ? 1 : -1;
    return [...records].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [records, sort]);

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
          {canEdit && (
            <>
              <Link href="/land-sales/import" className="btn btn-ghost">Import CSV</Link>
              <Link href="/land-sales/new" className="btn btn-ghost">+ Add Record</Link>
            </>
          )}
        </div>
      </div>

      <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', overflowX: 'auto', background: 'var(--color-accent-2-100)' }}>
        <table className="table" style={{ width: '100%', minWidth: 1100 }}>
          <thead style={{ background: 'var(--color-accent-2-200)' }}>
            <tr>
              <th style={{ width: 40 }}>
                <input type="checkbox" checked={records.length > 0 && selectedCount === records.length} onChange={toggleAll} aria-label="Select all rows" />
              </th>
              {COLUMNS.map(col => <SortableHeader key={col.key} column={col} sort={sort} onSort={handleSort} />)}
            </tr>
          </thead>
          <tbody style={{ background: '#FFFFFF' }}>
            {records.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-neutral-600)' }}>
                  No records match your search criteria.
                </td>
              </tr>
            ) : sortedRecords.map(r => {
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
                  <td>
                    {r.sale_date ? formatDate(r.sale_date) : r.sale_date_raw ? (
                      <span
                        title={`Unrecognized date from import: "${r.sale_date_raw}". Flagged for review.`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#92400e' }}
                      >
                        <TriangleAlert size={14} strokeWidth={2} />
                        {r.sale_date_raw}
                      </span>
                    ) : '—'}
                  </td>
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
