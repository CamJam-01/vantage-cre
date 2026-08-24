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
import { resultSortValue, type CoreResultField, type ResultColumn } from '@/lib/land-sales/result-columns';
import { fieldVisibilityId } from '@/lib/land-sales/field-visibility';

type Sort = { column: ResultColumn; dir: 'asc' | 'desc' };

function sameColumn(a: ResultColumn, b: ResultColumn): boolean {
  return a.kind === b.kind && a.key === b.key;
}

const stickyHeaderCellStyle = {
  color: 'var(--color-bg)', background: 'var(--color-accent-2-500)', position: 'sticky' as const, top: 0, zIndex: 4,
};

const rowActionButtonStyle = {
  width: 22,
  height: 22,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: '1px solid var(--color-neutral-400)',
  background: '#FFFFFF',
  cursor: 'pointer',
} as const;

const HEADER_GUTTER_PX = 92;

/** Keep a header to at most two lines: size to the longer of the longest
 * token and half the full label, plus sort icon and cell padding. */
function headerMinWidth(label: string): number {
  const pxPerChar = 7.2;
  const extra = 36;
  const tokens = label.split(/[\s/()-]+/).filter(Boolean);
  const longest = tokens.reduce((max, token) => Math.max(max, token.length), 1);
  const twoLineChars = Math.ceil(label.length / 2);
  return Math.max(96, Math.ceil(Math.max(longest, twoLineChars) * pxPerChar + extra));
}

function SortableHeader({ column, sort, onSort }: { column: ResultColumn; sort: Sort | null; onSort: (column: ResultColumn) => void }) {
  const active = sort ? sameColumn(sort.column, column) : false;
  return (
    <th
      style={{ ...stickyHeaderCellStyle, minWidth: headerMinWidth(column.label), cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onSort(column)}
    >
      <span className="col-header">
        <span className="col-header-label">{column.label}</span>
        {active && sort ? (
          sort.dir === 'asc' ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />
        ) : (
          <ChevronsUpDown size={12} strokeWidth={2} style={{ opacity: 0.35 }} />
        )}
      </span>
    </th>
  );
}

function SaleDateCell({ record }: { record: LandSale }) {
  if (record.sale_date) return formatDate(record.sale_date);
  if (record.sale_date_raw) {
    return (
      <span
        title={`Unrecognized date from import: "${record.sale_date_raw}". Flagged for review.`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#92400e' }}
      >
        <TriangleAlert size={14} strokeWidth={2} />
        {record.sale_date_raw}
      </span>
    );
  }
  return '—';
}

function CoreCell({ record, field }: { record: LandSale; field: CoreResultField }) {
  switch (field) {
    case 'sale_date':
      return <SaleDateCell record={record} />;
    case 'acreage':
    case 'square_feet':
      return formatNumber(record[field]);
    case 'sale_price':
    case 'price_per_acre':
      return formatCurrency(record[field]);
    case 'parcel_id':
    case 'address':
    case 'msa':
    case 'buyer':
      return record[field] || '—';
    case 'city':
    case 'county':
    case 'state':
    case 'property_type':
      return record[field];
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

function ResultCell({ record, column }: { record: LandSale; column: ResultColumn }) {
  switch (column.kind) {
    case 'extra':
      return record.extras?.[column.key] || '—';
    case 'core':
      return <CoreCell record={record} field={column.key} />;
    default: {
      const _exhaustive: never = column;
      return _exhaustive;
    }
  }
}

export function ResultsTable({ records, columns, canEdit, filters }: { records: LandSale[]; columns: ResultColumn[]; canEdit: boolean; filters: LandSaleFilters }) {
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

  function handleSort(column: ResultColumn) {
    setSort(prev => (prev && sameColumn(prev.column, column) ? { column, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { column, dir: 'asc' }));
  }

  const sortedRecords = useMemo(() => {
    if (!sort) return records;
    const { column, dir } = sort;
    const factor = dir === 'asc' ? 1 : -1;
    return [...records].sort((a, b) => {
      const av = resultSortValue(a, column);
      const bv = resultSortValue(b, column);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [records, sort]);

  const tableMinWidth = useMemo(
    () => HEADER_GUTTER_PX + columns.reduce((sum, column) => sum + headerMinWidth(column.label), 0),
    [columns],
  );

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
    const params = new URLSearchParams({ edit: '1' });
    if (searchQuery) params.set('from', searchQuery);
    router.push(`/land-sales/${id}?${params.toString()}`);
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
              <Link href="/land-sales/import" className="btn btn-ghost">Import CSV</Link>
            )}
            {canEdit && (
              <Link href="/land-sales/new" className="btn btn-ghost">+ Add Record</Link>
            )}
          </div>
        </div>
      </div>

      <FiltersSidebar filters={filters} />
      <div className="results-shell" style={{ flex: 1, display: 'flex', gap: 'var(--space-6)', boxSizing: 'border-box', background: 'var(--color-accent-2-200)' }}>
        <main style={{ flex: 1, minWidth: 0, paddingTop: 0, boxSizing: 'border-box' }}>
          <div style={{ width: '100%' }}>
            <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 250px)', background: 'var(--color-accent-2-100)' }}>
              <table className="table results-table" style={{ width: '100%', minWidth: tableMinWidth }}>
                <thead>
                  <tr>
                    <th style={{ ...stickyHeaderCellStyle, width: 40 }}>
                      <input type="checkbox" checked={records.length > 0 && selectedCount === records.length} onChange={toggleAll} aria-label="Select all rows" />
                    </th>
                    <th style={{ ...stickyHeaderCellStyle, width: 52 }} />
                    {columns.map(col => <SortableHeader key={fieldVisibilityId(col)} column={col} sort={sort} onSort={handleSort} />)}
                  </tr>
                </thead>
                <tbody style={{ background: '#FFFFFF' }}>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={2 + columns.length} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-neutral-600)' }}>
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
                        <td onClick={e => e.stopPropagation()} style={{ padding: 4, width: 52 }}>
                          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                            <button
                              type="button"
                              onClick={() => viewDetails(r.id)}
                              title="View Details"
                              aria-label="View Details"
                              style={rowActionButtonStyle}
                            >
                              <Eye size={12} strokeWidth={1.75} color="var(--color-accent-700)" />
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => editDetails(r.id)}
                                title="Edit Details"
                                aria-label="Edit Details"
                                style={rowActionButtonStyle}
                              >
                                <Pencil size={12} strokeWidth={1.75} color="var(--color-accent-700)" />
                              </button>
                            )}
                          </div>
                        </td>
                        {columns.map(col => (
                          <td key={fieldVisibilityId(col)}>
                            <ResultCell record={r} column={col} />
                          </td>
                        ))}
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
