'use client';

import { useMemo, useRef, useState, type PointerEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, ChevronsUpDown, Minus, TriangleAlert } from 'lucide-react';
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
import { MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, defaultColumnWidth, draggedColumnWidth, keyboardColumnWidth } from '@/lib/land-sales/column-width';
import { fieldVisibilityId } from '@/lib/land-sales/field-visibility';
import { keyedRecords, pageSelectionState } from '@/lib/land-sales/row-selection';
import { toggleResultsSort, type ResultsSort } from '@/lib/land-sales/results-sort';
import type { DocxOutputFlow } from '@/lib/land-sales/output-flows';
import { selectionFiltersKey, type SalesPath } from '@/lib/land-sales/sales-path';

const stickyHeaderCellStyle = {
  color: 'var(--color-bg)', background: 'var(--color-accent-2-500)', position: 'sticky' as const, top: 0, zIndex: 4,
};

const ROW_NUMBER_WIDTH_PX = 32;
const CHECKBOX_WIDTH_PX = 40;
const HEADER_GUTTER_PX = ROW_NUMBER_WIDTH_PX + CHECKBOX_WIDTH_PX;

function SortableHeader({
  column,
  sort,
  href,
  width,
  onResize,
}: {
  column: ResultColumn;
  sort: ResultsSort;
  href: string;
  width: number;
  onResize: (width: number, commit: boolean) => void;
}) {
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number; width: number } | null>(null);

  function finishResize(event: PointerEvent<HTMLSpanElement>, cancel = false) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const nextWidth = cancel ? current.startWidth : current.width;
    drag.current = null;
    event.currentTarget.removeAttribute('data-resizing');
    event.currentTarget.setAttribute('aria-valuenow', String(nextWidth));
    onResize(nextWidth, true);
  }

  const active = sort.column === column.key;
  return (
    <th
      style={{ ...stickyHeaderCellStyle, padding: 0 }}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Link href={href} className="col-header">
        <span className="col-header-label">{column.label}</span>
        {active ? (
          sort.dir === 'asc' ? <ChevronUp size={18} strokeWidth={1.5} /> : <ChevronDown size={18} strokeWidth={1.5} />
        ) : (
          <ChevronsUpDown size={22} strokeWidth={1.5} />
        )}
      </Link>
      <span
        className="column-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${column.label} column`}
        aria-valuemin={MIN_COLUMN_WIDTH}
        aria-valuemax={MAX_COLUMN_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        title="Drag to resize; use Left/Right arrows when focused"
        onClick={event => { event.preventDefault(); event.stopPropagation(); }}
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.setAttribute('data-resizing', '');
          drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width, width };
        }}
        onPointerMove={event => {
          const current = drag.current;
          if (!current || current.pointerId !== event.pointerId) return;
          current.width = draggedColumnWidth(current.startWidth, current.startX, event.clientX);
          event.currentTarget.setAttribute('aria-valuenow', String(current.width));
          onResize(current.width, false);
        }}
        onPointerUp={event => finishResize(event)}
        onPointerCancel={event => finishResize(event, true)}
        onLostPointerCapture={event => finishResize(event, true)}
        onKeyDown={event => {
          const nextWidth = keyboardColumnWidth(width, event.key);
          if (nextWidth == null) return;
          event.preventDefault();
          event.stopPropagation();
          onResize(nextWidth, true);
        }}
      />
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
  path,
  columns,
  canEdit,
  canDelete = false,
  filters,
  sort,
  outputFlows,
}: {
  path: SalesPath;
  columns: ResultColumn[];
  canEdit: boolean;
  canDelete?: boolean;
  filters: LandSaleFilters;
  sort: ResultsSort;
  outputFlows: DocxOutputFlow[];
}) {
  const filtersKey = selectionFiltersKey(path, encodeFilters(filters).toString());
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
      const response = await fetch(`${path.basePath}/export`, {
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
      downloadCsv(path.exportFilename, await response.text());
    } catch {
      setExportError('Could not export the selected records.');
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteLandSales(path.id, [...selectedIds]);
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
            {path.label} Results
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
        {canEdit && <ResultsAddMenu path={path} />}
        {canDelete && (
          <Button
            variant="icon"
            className="results-delete-badge"
            onClick={() => setConfirmDelete(true)}
            disabled={selectedCount < 1}
            aria-label="Delete selected records"
            title={selectedCount < 1 ? 'Select records to delete' : 'Delete selected records'}
          >
            <Minus size={20} strokeWidth={1.5} aria-hidden />
          </Button>
        )}
        <FiltersSidebar path={path} filters={filters} columns={columns} sort={sort} />
        <ResultsExportMenu
          disabled={selectedCount < 1 || exporting}
          onExportCsv={() => { void exportCsv(); }}
          onMergeDocx={() => setMergeOpen(true)}
          hasOutputFlows={outputFlows.length > 0}
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
        path={path}
        outputFlows={outputFlows}
        recordIds={[...selectedIds]}
      />
    </>
  );
}

export function ResultsTable({
  path,
  records,
  totalCount,
  page,
  columns,
  filters,
  sort,
}: {
  path: SalesPath;
  records: LandSale[];
  totalCount: number;
  page: number;
  columns: ResultColumn[];
  canEdit: boolean;
  filters: LandSaleFilters;
  sort: ResultsSort;
}) {
  const filtersKey = selectionFiltersKey(path, encodeFilters(filters).toString());
  const { selectedIds, toggleRow, togglePage } = useResultsSelection(filtersKey);

  return (
    <>
      <ResultsCount path={path} records={records} totalCount={totalCount} page={page} filters={filters} sort={sort} />
      <ResultsBody
        key={path.id}
        path={path}
        records={records}
        columns={columns}
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
  path,
  records,
  totalCount,
  page,
  filters,
  sort,
}: {
  path: SalesPath;
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
            <Link href={landSalesPageHref(filters, prevPage, sort, path.basePath)} className="btn btn-secondary">Previous</Link>
          ) : (
            <span className="btn btn-secondary" aria-disabled="true" style={{ pointerEvents: 'none', opacity: 0.45 }}>Previous</span>
          )}
          <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>
            Page {page} of {lastPage}
          </span>
          {page < lastPage ? (
            <Link href={landSalesPageHref(filters, page + 1, sort, path.basePath)} className="btn btn-secondary">Next</Link>
          ) : (
            <span className="btn btn-secondary" aria-disabled="true" style={{ pointerEvents: 'none', opacity: 0.45 }}>Next</span>
          )}
        </nav>
      )}
    </div>
  );
}

function ResultsBody({
  path,
  records,
  columns,
  sort,
  filters,
  selectedIds,
  toggleRow,
  togglePage,
  searchQuery,
}: {
  path: SalesPath;
  records: LandSale[];
  columns: ResultColumn[];
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

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const tableRef = useRef<HTMLTableElement>(null);
  const widths = columns.map(column => columnWidths[column.key] ?? defaultColumnWidth(column.label));
  const tableWidth = HEADER_GUTTER_PX + widths.reduce((sum, width) => sum + width, 0);

  function resizeColumn(index: number, width: number, commit: boolean) {
    const column = columns[index];
    // Preview the colgroup directly: dragging must not re-render thousands of
    // cells on each pointer move. React commits the final width on release.
    const table = tableRef.current;
    const col = table?.querySelectorAll('col')[index + 2];
    if (!table || !col) return;
    col.style.width = `${width}px`;
    table.style.width = `${tableWidth - widths[index] + width}px`;
    // Restore the preview explicitly on cancellation, even if React’s saved
    // width is unchanged and therefore produces no style update.
    if (commit) setColumnWidths(current => ({ ...current, [column.key]: width }));
  }

  function viewDetails(id: string) {
    router.push(searchQuery ? `${path.basePath}/${id}?from=${encodeURIComponent(searchQuery)}` : `${path.basePath}/${id}`);
  }

  return (
    <div className="results-shell" style={{ flex: 1, display: 'flex', gap: 'var(--space-6)', boxSizing: 'border-box', background: 'var(--color-accent-2-200)' }}>
      <main style={{ flex: 1, minWidth: 0, paddingTop: 0, boxSizing: 'border-box' }}>
        <div style={{ width: '100%' }}>
          <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 250px)', background: 'var(--color-accent-2-100)' }}>
            <table ref={tableRef} className="table results-table" style={{ width: tableWidth, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: ROW_NUMBER_WIDTH_PX }} />
                <col style={{ width: CHECKBOX_WIDTH_PX }} />
                {columns.map((column, index) => <col key={column.key} style={{ width: widths[index] }} />)}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...stickyHeaderCellStyle, width: ROW_NUMBER_WIDTH_PX }} />
                  <th style={{ ...stickyHeaderCellStyle, width: CHECKBOX_WIDTH_PX }}>
                    <input
                      type="checkbox"
                      className="results-checkbox results-checkbox--select-all"
                      checked={pageState === 'all'}
                      ref={input => {
                        if (input) input.indeterminate = pageState === 'some';
                      }}
                      onChange={() => togglePage(pageIds)}
                      aria-label="Select all rows on this page"
                    />
                  </th>
                  {columns.map((col, index) => (
                    <SortableHeader
                      key={fieldVisibilityId(col)}
                      column={col}
                      width={widths[index]}
                      onResize={(width, commit) => resizeColumn(index, width, commit)}
                      sort={sort}
                      href={landSalesPageHref(filters, 1, toggleResultsSort(sort, col.key), path.basePath)}
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
                ) : keyed.map(({ record: r, key }, index) => {
                  const isSelected = selectedIds.has(key);
                  const address = String(r.columns['Property Address'] ?? '').trim();
                  const parcel = String(r.columns['Parcel Number 1 (Min)'] ?? '').trim();
                  return (
                    <tr
                      key={key}
                      onClick={() => viewDetails(r.id)}
                      style={{ background: isSelected ? 'var(--color-accent-100)' : undefined, cursor: 'pointer', userSelect: 'none' }}
                    >
                      <td style={{ width: ROW_NUMBER_WIDTH_PX, textAlign: 'right', color: 'var(--color-neutral-600)', fontVariantNumeric: 'tabular-nums' }}>
                        {index + 1}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="results-checkbox results-checkbox--select-row" checked={isSelected} onChange={() => toggleRow(key)} aria-label={`Select ${parcel || address || r.id}`} />
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
