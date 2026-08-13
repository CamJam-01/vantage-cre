'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ChevronsUpDown, Eye, Pencil, TriangleAlert } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';
import { Button } from '@/components/ui/button';
import { FiltersSidebar } from '@/components/land-sales/filters-sidebar';
import type { LandSale } from '@/lib/land-sales/schema';
import { encodeFilters, type LandSaleFilters } from '@/lib/land-sales/search-params';
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

const stickyHeaderCellStyle = {
  color: 'var(--color-bg)', background: 'var(--color-accent-2-500)', position: 'sticky' as const, top: 0, zIndex: 4,
};

function SortableHeader({ column, sort, onSort }: { column: { key: SortKey; label: string }; sort: Sort | null; onSort: (key: SortKey) => void }) {
  const active = sort?.key === column.key;
  return (
    <th style={{ ...stickyHeaderCellStyle, cursor: 'pointer', userSelect: 'none' }} onClick={() => onSort(column.key)}>
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

export function ResultsTable({ records, canEdit, filters }: { records: LandSale[]; canEdit: boolean; filters: LandSaleFilters }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Carried as `?from=` so View Details / Edit can offer a "Back to search"
  // link that lands the user back on this exact filtered result set.
  const searchQuery = encodeFilters(filters).toString();

  function viewDetails(id: string) {
    router.push(searchQuery ? `/land-sales/${id}?from=${encodeURIComponent(searchQuery)}` : `/land-sales/${id}`);
  }

  function editDetails(id: string) {
    router.push(searchQuery ? `/land-sales/${id}/edit?from=${encodeURIComponent(searchQuery)}` : `/land-sales/${id}/edit`);
  }

  function toggleExportMenu() {
    if (!selectedCount) return;
    setExportMenuOpen(o => !o);
  }

  function exportCsv() {
    const selected = records.filter(r => selectedIds.has(r.id));
    if (!selected.length) return;
    setExportMenuOpen(false);
    downloadCsv('land-sales-export.csv', makeCsv(selected));
  }

  const selectionLabel = useMemo(() => (
    selectedCount === 0 ? 'No records selected' : `${selectedCount} record${selectedCount === 1 ? '' : 's'} selected`
  ), [selectedCount]);

  return (
    <>
      <div style={{ width: '100%', boxSizing: 'border-box', padding: 'var(--space-6) var(--space-6) var(--space-4)', background: 'var(--color-accent-2-200)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: '0 0 var(--space-1)' }}>
            Land Sales Results
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: 0 }}>
            {records.length} record{records.length === 1 ? '' : 's'} matching your search criteria
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>{selectionLabel}</span>
            <div ref={exportRef} style={{ position: 'relative' }}>
              <Button variant="secondary" onClick={toggleExportMenu} disabled={selectedCount < 1}>Export</Button>
              {exportMenuOpen && (
                <Blueprint elevation="md" style={{ position: 'absolute', top: 'calc(100% + var(--space-2))', right: 0, width: 180, background: '#FFFFFF', zIndex: 6 }}>
                  <button type="button" onClick={exportCsv} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 'var(--space-3) var(--space-4)', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-text)' }}>
                    Export CSV
                  </button>
                  <button type="button" disabled style={{ display: 'block', width: '100%', textAlign: 'left', padding: 'var(--space-3) var(--space-4)', border: 'none', borderTop: '1px solid var(--color-neutral-300)', background: 'none', cursor: 'not-allowed', opacity: 0.45, fontSize: 14, color: 'var(--color-text)' }} title="Coming in a later phase">
                    Merge to DOCX
                  </button>
                </Blueprint>
              )}
            </div>
            {canEdit && (
              <Link href="/land-sales/new" className="btn btn-ghost">+ Add Record</Link>
            )}
          </div>
        </div>
      </div>

      <div className="results-shell" style={{ flex: 1, display: 'flex', gap: 'var(--space-6)', padding: '0 var(--space-6) calc(var(--space-2) * 3)', boxSizing: 'border-box', background: 'var(--color-accent-2-200)' }}>
        <FiltersSidebar filters={filters} />
        <main style={{ flex: 1, minWidth: 0, paddingTop: 0, boxSizing: 'border-box' }}>
          <div style={{ width: '100%' }}>
            <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 250px)', background: 'var(--color-accent-2-100)' }}>
              <table className="table" style={{ width: '100%', minWidth: 1150 }}>
                <thead>
                  <tr>
                    <th style={{ ...stickyHeaderCellStyle, width: 40 }}>
                      <input type="checkbox" checked={records.length > 0 && selectedCount === records.length} onChange={toggleAll} aria-label="Select all rows" />
                    </th>
                    <th style={{ ...stickyHeaderCellStyle, width: 40 }} />
                    <th style={{ ...stickyHeaderCellStyle, width: 40 }} />
                    {COLUMNS.map(col => <SortableHeader key={col.key} column={col} sort={sort} onSort={handleSort} />)}
                  </tr>
                </thead>
                <tbody style={{ background: '#FFFFFF' }}>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={15} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-neutral-600)' }}>
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
                        <td onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => viewDetails(r.id)}
                            title="View Details"
                            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: '1px solid var(--color-neutral-400)', background: '#FFFFFF', cursor: 'pointer' }}
                          >
                            <Eye size={16} strokeWidth={1.5} color="var(--color-accent-700)" />
                          </button>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => editDetails(r.id)}
                              title="Edit Details"
                              style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: '1px solid var(--color-neutral-400)', background: '#FFFFFF', cursor: 'pointer' }}
                            >
                              <Pencil size={16} strokeWidth={1.5} color="var(--color-accent-700)" />
                            </button>
                          )}
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
          </div>
        </main>
      </div>
    </>
  );
}
