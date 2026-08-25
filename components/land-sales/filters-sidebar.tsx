'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Filter, X } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';
import { Button } from '@/components/ui/button';
import {
  addFilterCandidates,
  appliedToDraft,
  compactDraftFilters,
  draftsDiffer,
  emptyDraftFilter,
  type DraftFieldFilter,
} from '@/lib/land-sales/field-filters';
import {
  appliedFilterCount,
  encodeFilters,
  type LandSaleFilters,
} from '@/lib/land-sales/search-params';
import type { ResultColumn } from '@/lib/land-sales/result-columns';

/** The "+ Add Filter" trigger sits inside the sidebar's own `overflow-y:auto`
 * region, so an absolutely-positioned menu gets silently clipped by that
 * ancestor whenever it would extend past the sidebar's current scrolled
 * viewport. `position: fixed` escapes that clipping (it's laid out against
 * the browser viewport, not the nearest positioned/scrolling ancestor), so
 * this computes pixel coordinates from the trigger's rect instead of relying
 * on CSS percentages. It also picks whichever side (above/below the trigger)
 * has more room and caps the menu's height to that room with its own scroll,
 * so every option stays reachable even in a short viewport. */
function computeMenuStyle(triggerRect: DOMRect): CSSProperties {
  const gap = 8;
  const viewportHeight = window.innerHeight;
  const spaceAbove = triggerRect.top - gap;
  const spaceBelow = viewportHeight - triggerRect.bottom - gap;
  const openUpward = spaceAbove >= spaceBelow;
  const maxHeight = Math.max(80, Math.min(320, openUpward ? spaceAbove : spaceBelow));
  return {
    position: 'fixed',
    left: triggerRect.left,
    width: triggerRect.width,
    maxHeight,
    overflow: 'hidden',
    ...(openUpward ? { bottom: viewportHeight - triggerRect.top + gap } : { top: triggerRect.bottom + gap }),
  };
}

export function FiltersSidebar({ filters, columns }: { filters: LandSaleFilters; columns: ResultColumn[] }) {
  const router = useRouter();
  const filtersKey = encodeFilters(filters).toString();
  const [draft, setDraft] = useState<DraftFieldFilter[]>(() => appliedToDraft(filters.fieldFilters ?? []));
  const [syncedKey, setSyncedKey] = useState(filtersKey);
  const [open, setOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuStyle, setAddMenuStyle] = useState<CSSProperties | null>(null);
  const [addQuery, setAddQuery] = useState('');
  const addMenuRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  const activeCount = appliedFilterCount(filters);
  const dirty = draftsDiffer(draft, filters.fieldFilters ?? []);
  const draftedColumns = draft.map(item => item.column);
  const candidates = addFilterCandidates(columns, draftedColumns, addQuery);
  const canAddMore = addFilterCandidates(columns, draftedColumns, '').length > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close the fixed menu when the sidebar (or page) scrolls so it doesn't
  // float away from its trigger — but ignore scrolls *inside* the menu itself,
  // otherwise the field list can't be navigated.
  useEffect(() => {
    if (!addMenuOpen) return;
    function onScroll(e: Event) {
      const target = e.target;
      if (target instanceof Node && addMenuRef.current?.contains(target)) return;
      setAddMenuOpen(false);
    }
    function onResize() { setAddMenuOpen(false); }
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [addMenuOpen]);

  function toggleAddMenu() {
    if (!addMenuOpen && addMenuRef.current) {
      setAddMenuStyle(computeMenuStyle(addMenuRef.current.getBoundingClientRect()));
      setAddQuery('');
    }
    setAddMenuOpen(o => !o);
  }

  if (filtersKey !== syncedKey) {
    setSyncedKey(filtersKey);
    setDraft(appliedToDraft(filters.fieldFilters ?? []));
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setAddMenuOpen(false);
      setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      closeBtnRef.current?.focus();
      return;
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      badgeRef.current?.focus();
    }
  }, [open]);

  function addFilter(column: string) {
    setDraft(prev => prev.some(item => item.column === column) ? prev : [...prev, emptyDraftFilter(column)]);
    setAddMenuOpen(false);
  }

  function removeFilter(column: string) {
    setDraft(prev => prev.filter(item => item.column !== column));
  }

  function replaceFilter(next: DraftFieldFilter) {
    setDraft(prev => prev.map(item => item.column === next.column ? next : item));
  }

  function applyFilters() {
    const next: LandSaleFilters = { ...filters, fieldFilters: compactDraftFilters(draft) };
    router.replace(`/land-sales?${encodeFilters(next).toString()}`);
    setAddMenuOpen(false);
    setOpen(false);
  }

  function cancelDraft() {
    setDraft(appliedToDraft(filters.fieldFilters ?? []));
  }

  return (
    <>
      <button
        ref={badgeRef}
        type="button"
        className="blueprint elev-md results-sidebar-badge"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="results-sidebar"
        hidden={open}
      >
        <Filter size={16} strokeWidth={1.75} aria-hidden />
        Filters
        {activeCount > 0 ? (
          <span className="tag tag-accent">{activeCount}</span>
        ) : null}
      </button>

      <div
        className={`results-sidebar-backdrop${open ? ' is-open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <aside
        id="results-sidebar"
        className={`blueprint elev-sm results-sidebar${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="results-sidebar-title"
        aria-hidden={!open}
        inert={!open}
      >
        <div style={{ paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-neutral-300)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <span id="results-sidebar-title" style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>
            Search Filters
            {activeCount > 0 && (
              <span className="tag tag-accent" style={{ marginLeft: 'var(--space-2)', verticalAlign: 'middle' }}>{activeCount} active</span>
            )}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
            <Link href="/search/sales/land" style={{ fontSize: 13, fontWeight: 600 }}>Modify Search</Link>
            <button
              ref={closeBtnRef}
              type="button"
              className="btn btn-icon"
              onClick={() => setOpen(false)}
              aria-label="Close filters"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="results-sidebar-content" style={{ paddingTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {draft.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-neutral-600)', margin: 0 }}>
            No filters added yet. Use &quot;+ Add Filter&quot; below or &quot;Modify Search&quot; above.
          </p>
        )}

        {draft.map(item => (
          <DraftFilterControl
            key={item.column}
            item={item}
            onChange={replaceFilter}
            onRemove={() => removeFilter(item.column)}
          />
        ))}

        <div ref={addMenuRef} style={{ position: 'relative', borderTop: draft.length ? '1px solid var(--color-neutral-300)' : undefined, paddingTop: draft.length ? 'var(--space-4)' : undefined }}>
          <Button
            variant="ghost"
            block
            onClick={toggleAddMenu}
            disabled={!canAddMore}
            title={!canAddMore ? 'All visible fields are already added' : undefined}
          >
            + Add Filter
          </Button>
          {addMenuOpen && addMenuStyle && (
            <Blueprint elevation="md" style={{ ...addMenuStyle, background: '#FFFFFF', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flexShrink: 0, padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-neutral-300)' }}>
                <input
                  className="input"
                  type="search"
                  value={addQuery}
                  onChange={e => setAddQuery(e.target.value)}
                  placeholder="Search fields"
                  aria-label="Search fields"
                  autoFocus
                  style={{ backgroundColor: '#FFFFFF' }}
                />
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {candidates.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--color-neutral-600)', margin: 0, padding: 'var(--space-3) var(--space-4)' }}>
                    No matching fields
                  </p>
                ) : candidates.map(column => (
                  <button
                    key={column.key}
                    type="button"
                    onClick={() => addFilter(column.key)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: 'var(--space-3) var(--space-4)', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-text)' }}
                  >
                    {column.label}
                  </button>
                ))}
              </div>
            </Blueprint>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', borderTop: '1px solid var(--color-neutral-300)', paddingTop: 'var(--space-4)' }}>
          <Button variant="primary" onClick={applyFilters} disabled={!dirty} style={{ flex: 1 }}>
            Apply Filters
          </Button>
          <Button variant="ghost" onClick={cancelDraft} disabled={!dirty} style={{ flex: 1 }}>
            Cancel
          </Button>
        </div>

      </div>
    </aside>
    </>
  );
}

function DraftFilterControl({
  item,
  onChange,
  onRemove,
}: {
  item: DraftFieldFilter;
  onChange: (next: DraftFieldFilter) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{item.column}</label>
        <button type="button" className="btn btn-icon" onClick={onRemove} aria-label={`Remove ${item.column} filter`}>
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
      <DraftFilterFields item={item} onChange={onChange} />
    </div>
  );
}

function filterControlId(column: string, suffix?: string): string {
  const base = `filter-${column.replaceAll(/[^a-zA-Z0-9]+/g, '-')}`;
  return suffix ? `${base}-${suffix}` : base;
}

function DraftFilterFields({
  item,
  onChange,
}: {
  item: DraftFieldFilter;
  onChange: (next: DraftFieldFilter) => void;
}) {
  switch (item.kind) {
    case 'text':
      return (
        <div className="field">
          <label htmlFor={filterControlId(item.column)}>Contains</label>
          <input
            id={filterControlId(item.column)}
            className="input"
            type="text"
            value={item.contains}
            onChange={e => onChange({ ...item, contains: e.target.value })}
            style={{ backgroundColor: '#FFFFFF' }}
          />
        </div>
      );
    case 'number':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div className="field">
            <label htmlFor={filterControlId(item.column, 'min')}>Min</label>
            <input
              id={filterControlId(item.column, 'min')}
              className="input"
              type="text"
              inputMode="decimal"
              value={item.min}
              onChange={e => onChange({ ...item, min: e.target.value })}
              style={{ backgroundColor: '#FFFFFF' }}
            />
          </div>
          <div className="field">
            <label htmlFor={filterControlId(item.column, 'max')}>Max</label>
            <input
              id={filterControlId(item.column, 'max')}
              className="input"
              type="text"
              inputMode="decimal"
              value={item.max}
              onChange={e => onChange({ ...item, max: e.target.value })}
              style={{ backgroundColor: '#FFFFFF' }}
            />
          </div>
        </div>
      );
    case 'date':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div className="field">
            <label htmlFor={filterControlId(item.column, 'from')}>From</label>
            <input
              id={filterControlId(item.column, 'from')}
              className="input"
              type="date"
              value={item.from}
              onChange={e => onChange({ ...item, from: e.target.value })}
              style={{ backgroundColor: '#FFFFFF' }}
            />
          </div>
          <div className="field">
            <label htmlFor={filterControlId(item.column, 'to')}>To</label>
            <input
              id={filterControlId(item.column, 'to')}
              className="input"
              type="date"
              value={item.to}
              onChange={e => onChange({ ...item, to: e.target.value })}
              style={{ backgroundColor: '#FFFFFF' }}
            />
          </div>
        </div>
      );
    case 'boolean':
      return (
        <div className="field">
          <label htmlFor={filterControlId(item.column)}>Value</label>
          <select
            id={filterControlId(item.column)}
            className="input"
            value={item.value}
            onChange={e => {
              const value = e.target.value;
              if (value === '' || value === 'true' || value === 'false') onChange({ ...item, value });
            }}
            style={{ backgroundColor: '#FFFFFF', cursor: 'pointer' }}
          >
            <option value=""></option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      );
    default: {
      const _exhaustive: never = item;
      return _exhaustive;
    }
  }
}
