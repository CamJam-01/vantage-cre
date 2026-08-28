'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, ChevronsUpDown, Eye, Pencil, TriangleAlert } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FiltersSidebar } from '@/components/land-sales/filters-sidebar';
import { ResultsAddMenu } from '@/components/land-sales/results-add-menu';
import { ResultsExportMenu } from '@/components/land-sales/results-export-menu';
import { MergeDocxDialog } from '@/components/land-sales/merge-docx-dialog';
import { useActivateResultsSelection, useResultsSelection } from '@/components/land-sales/results-selection';
import { deleteLandSales } from '@/app/(app)/land-sales/actions';
import { flaggedSaleDateRaw, type LandSale } from '@/lib/land-sales/schema';
import { encodeFilters, type LandSaleFilters } from '@/lib/land-sales/search-params';
import { PAGE_SIZE, landSalesPageHref, landSalesReturnQuery, resultsRangeLabel } from '@/lib/land-sales/pagination';
import { formatCatalogValue, formatDate } from '@/lib/land-sales/format';
import { downloadCsv } from '@/lib/land-sales/csv';
import type { ResultColumn } from '@/lib/land-sales/result-columns';
import { fieldVisibilityId } from '@/lib/land-sales/field-visibility';
import { keyedRecords, pageSelectionState } from '@/lib/land-sales/row-selection';
import { toggleResultsSort, type ResultsSort } from '@/lib/land-sales/results-sort';
import type { DocxTemplate } from '@/lib/land-sales/docx-templates';

const stickyHeaderCellStyle = {
  color: 'var(--color-bg)', background: 'var(--color-accent-2-500)', position: 'sticky' as const, top: 0, zIndex: 4,
};

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

function SortableHeader({
  column,
  sort,
  href,
}: {
  column: ResultColumn;
  sort: ResultsSort;
  href: string;
}) {
  const active = sort.column === column.key;
  return (
    <th
      style={{ ...stickyHeaderCellStyle, minWidth: headerMinWidth(column.label), padding: 0 }}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Link href={href} className="col-header">
        <span className="col-header-label">{column.label}</span>
        {active ? (
          sort.dir === 'asc' ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />
        ) : (
          <ChevronsUpDown size={12} strokeWidth={1.5} style={{ opacity: 0.35 }} />
        )}
      </Link>
    </th>
  );
}

function SaleDateCell({ record }: { record: LandSale }) {
  const flagged = flaggedSaleDateRaw(record);
  if (!flagged) {
    const typed = record.columns['Sale Date'];
    return typed != null && typed !== '' ? formatDate(String(typed)) : '—';
  }
  return (
    <span
      className="record-flag"
      title={`Unrecognized date from import: "${flagged}". Flagged for review.`}
    >
      <TriangleAlert size={14} strokeWidth={1.5} />
      {flagged}
    </span>
  );
}

function ResultCell({ record, column }: { record: LandSale; column: ResultColumn }) {
  if (column.key === 'Sale Date') return <SaleDateCell record={record} />;
  return formatCatalogValue(column.key, record.columns[column.key]);
}

function exportFailureMessage(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return 'Could not export the selected records.';
}

export function ResultsToolbar({
  columns,
  canEdit,
  canDelete = false,
  filters,
  sort,
  mergeTemplates,
}: {
  columns: ResultColumn[];
  canEdit: boolean;
  canDelete?: boolean;
  filters: LandSaleFilters;
  sort: ResultsSort;
  mergeTemplates: DocxTemplate[];
}) {
  const filtersKey = encodeFilters(filters).toString();
  useActivateResultsSelection(filtersKey);
  const { selectedIds, selectedCount, clear } = useResultsSelection(filtersKey);
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  async function exportCsv() {
    if (!selectedCount) return;
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch('/land-sales/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const message = exportFailureMessage(payload);
        setExportError(message);
        return;
      }
      downloadCsv('land-sales-export.csv', await response.text());
    } catch {
      setExportError('Could not export the selected records.');
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteLandSales([...selectedIds]);
    setDeleting(false);
    if (result?.error) {
      setDeleteError(result.error);
      return;
    }
    setConfirmDelete(false);
    clear();
    router.refresh();
  }

  const selectionLabel = selectedCount === 0
    ? 'No records selected'
    : `${selectedCount} record${selectedCount === 1 ? '' : 's'} selected`;

  return (
    <>
      <div style={{ width: '100%', boxSizing: 'border-box', padding: 'var(--space-6) var(--space-6) var(--space-4)', background: 'var(--color-accent-2-200)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: 0 }}>
            Land Sales Results
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: 0 }}>
            {selectionLabel}
          </p>
          {(deleteError || exportError) && (
            <p className="record-error" style={{ margin: 0 }}>{deleteError ?? exportError}</p>
          )}
        </div>
      </div>

      <div className="results-fab-dock">
        {canEdit && <ResultsAddMenu />}
        {canDelete && (
          <Button
            variant="secondary"
            onClick={() => setConfirmDelete(true)}
            disabled={selectedCount < 1}
            title={selectedCount < 1 ? 'Select records to delete' : 'Delete selected records'}
          >
            Delete
          </Button>
        )}
        <FiltersSidebar filters={filters} columns={columns} sort={sort} />
        <ResultsExportMenu
          disabled={selectedCount < 1 || exporting}
          onExportCsv={() => { void exportCsv(); }}
          onMergeDocx={() => setMergeOpen(true)}
        />
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${selectedCount} record${selectedCount === 1 ? '' : 's'}?`}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </button>
            <Button variant="primary" onClick={handleDelete} disabled={deleting || selectedCount < 1}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--color-text)', margin: 0 }}>
          This cannot be undone. The selected records are removed from the database.
        </p>
      </Dialog>

      <MergeDocxDialog
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        templates={mergeTemplates}
        recordIds={[...selectedIds]}
      />
    </>
  );
}

export function ResultsTable({
  records,
  totalCount,
  page,
  columns,
  canEdit,
  filters,
  sort,
}: {
  records: LandSale[];
  totalCount: number;
  page: number;
  columns: ResultColumn[];
  canEdit: boolean;
  filters: LandSaleFilters;
  sort: ResultsSort;
}) {
  const filtersKey = encodeFilters(filters).toString();
  const { selectedIds, toggleRow, togglePage } = useResultsSelection(filtersKey);

  return (
    <>
      <ResultsCount records={records} totalCount={totalCount} page={page} filters={filters} sort={sort} />
      <ResultsBody
        records={records}
        columns={columns}
        canEdit={canEdit}
        sort={sort}
        filters={filters}
        selectedIds={selectedIds}
        toggleRow={toggleRow}
        togglePage={togglePage}
        searchQuery={landSalesReturnQuery(filters, page, sort)}
      />
    </>
  );
}

function ResultsCount({
  records,
  totalCount,
  page,
  filters,
  sort,
}: {
  records: LandSale[];
  totalCount: number;
  page: number;
  filters: LandSaleFilters;
  sort: ResultsSort;
}) {
  const lastPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const prevPage = page > lastPage ? lastPage : page - 1;
  const showPager = lastPage > 1 || page > 1;

  return (
    <div style={{ width: '100%', boxSizing: 'border-box', padding: '0 var(--space-6) var(--space-3)', background: 'var(--color-accent-2-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
      <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: 0 }}>
        {resultsRangeLabel(page, totalCount, records.length)} matching your search criteria
      </p>
      {showPager && (
        <nav aria-label="Results pages" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {page > 1 ? (
            <Link href={landSalesPageHref(filters, prevPage, sort)} className="btn btn-secondary">Previous</Link>
          ) : (
            <span className="btn btn-secondary" aria-disabled="true" style={{ pointerEvents: 'none', opacity: 0.45 }}>Previous</span>
          )}
          <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>
            Page {page} of {lastPage}
          </span>
          {page < lastPage ? (
            <Link href={landSalesPageHref(filters, page + 1, sort)} className="btn btn-secondary">Next</Link>
          ) : (
            <span className="btn btn-secondary" aria-disabled="true" style={{ pointerEvents: 'none', opacity: 0.45 }}>Next</span>
          )}
        </nav>
      )}
    </div>
  );
}

function ResultsBody({
  records,
  columns,
  canEdit,
  sort,
  filters,
  selectedIds,
  toggleRow,
  togglePage,
  searchQuery,
}: {
  records: LandSale[];
  columns: ResultColumn[];
  canEdit: boolean;
  sort: ResultsSort;
  filters: LandSaleFilters;
  selectedIds: Set<string>;
  toggleRow: (id: string) => void;
  togglePage: (pageIds: readonly string[]) => void;
  searchQuery: string;
}) {
  const router = useRouter();
  const keyed = useMemo(() => keyedRecords(records), [records]);
  const pageIds = useMemo(() => keyed.map(row => row.key), [keyed]);
  const pageState = pageSelectionState(selectedIds, pageIds);

  const tableMinWidth = useMemo(
    () => HEADER_GUTTER_PX + columns.reduce((sum, column) => sum + headerMinWidth(column.label), 0),
    [columns],
  );

  function viewDetails(id: string) {
    router.push(searchQuery ? `/land-sales/${id}?from=${encodeURIComponent(searchQuery)}` : `/land-sales/${id}`);
  }

  function editDetails(id: string) {
    const params = new URLSearchParams({ edit: '1' });
    if (searchQuery) params.set('from', searchQuery);
    router.push(`/land-sales/${id}?${params.toString()}`);
  }

  return (
    <div className="results-shell" style={{ flex: 1, display: 'flex', gap: 'var(--space-6)', boxSizing: 'border-box', background: 'var(--color-accent-2-200)' }}>
      <main style={{ flex: 1, minWidth: 0, paddingTop: 0, boxSizing: 'border-box' }}>
        <div style={{ width: '100%' }}>
          <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 250px)', background: 'var(--color-accent-2-100)' }}>
            <table className="table results-table" style={{ width: '100%', minWidth: tableMinWidth }}>
              <thead>
                <tr>
                  <th style={{ ...stickyHeaderCellStyle, width: 40 }}>
                    <input
                      type="checkbox"
                      checked={pageState === 'all'}
                      ref={input => {
                        if (input) input.indeterminate = pageState === 'some';
                      }}
                      onChange={() => togglePage(pageIds)}
                      aria-label="Select all rows on this page"
                    />
                  </th>
                  <th style={{ ...stickyHeaderCellStyle, width: 52 }} />
                  {columns.map(col => (
                    <SortableHeader
                      key={fieldVisibilityId(col)}
                      column={col}
                      sort={sort}
                      href={landSalesPageHref(filters, 1, toggleResultsSort(sort, col.key))}
                    />
                  ))}
                </tr>
              </thead>
              <tbody style={{ background: 'var(--color-paper)' }}>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={2 + columns.length} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-neutral-600)' }}>
                      No records match your search criteria.
                    </td>
                  </tr>
                ) : keyed.map(({ record: r, key }) => {
                  const isSelected = selectedIds.has(key);
                  const address = String(r.columns['Property Address'] ?? '').trim();
                  const parcel = String(r.columns['Parcel Number 1 (Min)'] ?? '').trim();
                  return (
                    <tr
                      key={key}
                      onClick={() => toggleRow(key)}
                      style={{ background: isSelected ? 'var(--color-accent-100)' : undefined, cursor: 'pointer' }}
                    >
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleRow(key)} aria-label={`Select ${parcel || address || r.id}`} />
                      </td>
                      <td onClick={e => e.stopPropagation()} style={{ padding: 4, width: 52 }}>
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                          <button
                            type="button"
                            className="row-action-btn"
                            onClick={() => viewDetails(r.id)}
                            title="View Details"
                            aria-label="View Details"
                          >
                            <Eye size={12} strokeWidth={1.5} />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              className="row-action-btn"
                              onClick={() => editDetails(r.id)}
                              title="Edit Details"
                              aria-label="Edit Details"
                            >
                              <Pencil size={12} strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      </td>
                      {columns.map(col => (
                        <td key={fieldVisibilityId(col)}>
                          <div className="results-cell">
                            <ResultCell record={r} column={col} />
                          </div>
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
  );
}
