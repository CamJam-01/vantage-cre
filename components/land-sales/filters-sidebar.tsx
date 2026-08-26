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
  type TimeFilter,
} from '@/lib/land-sales/search-params';
import { US_STATES } from '@/lib/land-sales/constants';
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

type SearchFilterEntry =
  | { kind: 'number'; key: string; label: string; min: string; max: string; remove: () => void; commit: (min: string, max: string) => void }
  | { kind: 'text'; key: string; label: string; value: string; remove: () => void; commit: (v: string) => void }
  | { kind: 'state'; key: string; value: string; remove: () => void; commit: (v: string) => void }
  | { kind: 'type'; key: string; value: string; remove: () => void }
  | { kind: 'dateRange'; key: string; label: string; from: string; to: string; remove: () => void; commit: (from: string, to: string) => void }
  | { kind: 'last'; key: string; label: string; duration: string; unit: 'months' | 'years'; remove: () => void; commit: (duration: string, unit: 'months' | 'years') => void };

function buildSearchFilterEntries(
  filters: LandSaleFilters,
  apply: (next: LandSaleFilters) => void,
): SearchFilterEntry[] {
  const set = (patch: Partial<LandSaleFilters>): LandSaleFilters => ({ ...filters, ...patch });
  const commit = (next: LandSaleFilters) => apply(next);

  const entries: SearchFilterEntry[] = [];

  if (filters.state !== undefined) {
    entries.push({
      kind: 'state', key: 'state', value: filters.state,
      remove: () => commit(set({ state: undefined })),
      commit: v => commit(set({ state: v || undefined })),
    });
  }
  if (filters.msa !== undefined) {
    entries.push({
      kind: 'text', key: 'msa', label: 'MSA', value: filters.msa,
      remove: () => commit(set({ msa: undefined })),
      commit: v => commit(set({ msa: v.trim() || undefined })),
    });
  }
  if (filters.county !== undefined) {
    entries.push({
      kind: 'text', key: 'county', label: 'County', value: filters.county,
      remove: () => commit(set({ county: undefined })),
      commit: v => commit(set({ county: v.trim() || undefined })),
    });
  }
  if (filters.city !== undefined) {
    entries.push({
      kind: 'text', key: 'city', label: 'City', value: filters.city,
      remove: () => commit(set({ city: undefined })),
      commit: v => commit(set({ city: v.trim() || undefined })),
    });
  }
  for (const type of filters.types) {
    entries.push({
      kind: 'type', key: `type:${type}`, value: type,
      remove: () => commit(set({ types: filters.types.filter(t => t !== type) })),
    });
  }
  if (filters.sfMin != null || filters.sfMax != null) {
    entries.push({
      kind: 'number', key: 'sf', label: 'Land Area SF',
      min: filters.sfMin != null ? String(filters.sfMin) : '',
      max: filters.sfMax != null ? String(filters.sfMax) : '',
      remove: () => commit(set({ sfMin: undefined, sfMax: undefined })),
      commit: (min, max) => commit(set({
        sfMin: min === '' ? undefined : Number(min),
        sfMax: max === '' ? undefined : Number(max),
      })),
    });
  }
  if (filters.acMin != null || filters.acMax != null) {
    entries.push({
      kind: 'number', key: 'ac', label: 'Land Area AC',
      min: filters.acMin != null ? String(filters.acMin) : '',
      max: filters.acMax != null ? String(filters.acMax) : '',
      remove: () => commit(set({ acMin: undefined, acMax: undefined })),
      commit: (min, max) => commit(set({
        acMin: min === '' ? undefined : Number(min),
        acMax: max === '' ? undefined : Number(max),
      })),
    });
  }
  const time = filters.time;
  if (time?.mode === 'last' && (time as { mode: 'last'; duration: number; unit: 'months' | 'years' }).duration) {
    const t = time as { mode: 'last'; duration: number; unit: 'months' | 'years' };
    entries.push({
      kind: 'last', key: 'time', label: 'Sale Date',
      duration: String(t.duration), unit: t.unit,
      remove: () => commit(set({ time: undefined })),
      commit: (duration, unit) => {
        const n = Number(duration);
        if (!Number.isFinite(n) || n <= 0) { commit(set({ time: undefined })); return; }
        const next: TimeFilter = { mode: 'last', duration: n, unit };
        commit(set({ time: next }));
      },
    });
  } else if (time?.mode === 'range' && (time.from || time.to)) {
    const t = time as { mode: 'range'; from?: string; to?: string };
    entries.push({
      kind: 'dateRange', key: 'time', label: 'Sale Date',
      from: t.from ?? '', to: t.to ?? '',
      remove: () => commit(set({ time: undefined })),
      commit: (from, to) => commit(set({ time: { mode: 'range', from: from || undefined, to: to || undefined } })),
    });
  }
  return entries;
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
  const [searchEdits, setSearchEdits] = useState<Record<string, Partial<{
    min: string; max: string; value: string; state: string;
    from: string; to: string; duration: string; unit: 'months' | 'years';
  }>>>({});
  const addMenuRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  const activeCount = appliedFilterCount(filters);
  const applySearch = (next: LandSaleFilters) => {
    router.replace(`/land-sales?${encodeFilters(next).toString()}`);
  };
  const searchEntries = buildSearchFilterEntries(filters, applySearch);
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
    setSearchEdits({});
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
    setAddMenuOpen(false);
    setOpen(false);
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
            <Link href={`/search/sales/land?${filtersKey}`} style={{ fontSize: 13, fontWeight: 600 }}>Modify Search</Link>
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

        {searchEntries.map(entry => (
          <SearchFilterControl
            key={entry.key}
            entry={entry}
            edits={searchEdits[entry.key]}
            onLocalChange={patch => setSearchEdits(prev => ({ ...prev, [entry.key]: { ...prev[entry.key], ...patch } }))}
            onClearLocal={() => setSearchEdits(prev => { const { [entry.key]: _drop, ...rest } = prev; void _drop; return rest; })}
          />
        ))}

        {draft.length === 0 && searchEntries.length === 0 && (
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
          <Button variant="ghost" onClick={cancelDraft} style={{ flex: 1 }}>
            Cancel
          </Button>
        </div>

      </div>
    </aside>
    </>
  );
}

const removeFilterButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: '#dc2626',
  cursor: 'pointer',
  flexShrink: 0,
} as const;

function RemoveFilterButton({ column, onRemove }: { column: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${column} filter`}
      style={removeFilterButtonStyle}
    >
      <X size={14} strokeWidth={2} />
    </button>
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
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{item.column}</label>
      <DraftFilterFields item={item} onChange={onChange} onRemove={onRemove} />
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
  onRemove,
}: {
  item: DraftFieldFilter;
  onChange: (next: DraftFieldFilter) => void;
  onRemove: () => void;
}) {
  switch (item.kind) {
    case 'text':
      return (
        <div className="field">
          <label htmlFor={filterControlId(item.column)}>Contains</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <input
              id={filterControlId(item.column)}
              className="input"
              type="text"
              value={item.contains}
              onChange={e => onChange({ ...item, contains: e.target.value })}
              style={{ backgroundColor: '#FFFFFF', flex: 1, minWidth: 0 }}
            />
            <RemoveFilterButton column={item.column} onRemove={onRemove} />
          </div>
        </div>
      );
    case 'number':
      return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', height: 36, flexShrink: 0 }}>
            <RemoveFilterButton column={item.column} onRemove={onRemove} />
          </div>
        </div>
      );
    case 'date':
      return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', height: 36, flexShrink: 0 }}>
            <RemoveFilterButton column={item.column} onRemove={onRemove} />
          </div>
        </div>
      );
    case 'boolean':
      return (
        <div className="field">
          <label htmlFor={filterControlId(item.column)}>Value</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <select
              id={filterControlId(item.column)}
              className="input"
              value={item.value}
              onChange={e => {
                const value = e.target.value;
                if (value === '' || value === 'true' || value === 'false') onChange({ ...item, value });
              }}
              style={{ backgroundColor: '#FFFFFF', cursor: 'pointer', flex: 1, minWidth: 0 }}
            >
              <option value=""></option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
            <RemoveFilterButton column={item.column} onRemove={onRemove} />
          </div>
        </div>
      );
    default: {
      const _exhaustive: never = item;
      return _exhaustive;
    }
  }
}

type SearchEdit = Partial<{
  min: string; max: string; value: string; state: string;
  from: string; to: string; duration: string; unit: 'months' | 'years';
}>;

function searchControlId(key: string, suffix?: string): string {
  const base = `search-${key.replaceAll(/[^a-zA-Z0-9]+/g, '-')}`;
  return suffix ? `${base}-${suffix}` : base;
}

function SearchFilterControl({
  entry,
  edits,
  onLocalChange,
  onClearLocal,
}: {
  entry: SearchFilterEntry;
  edits?: SearchEdit;
  onLocalChange: (patch: SearchEdit) => void;
  onClearLocal: () => void;
}) {
  const rowStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' };
  const removeLabel = entry.kind === 'state' ? 'State' : entry.kind === 'type' ? 'Secondary Type' : (entry as { label?: string }).label ?? entry.key;
  const onRemove = () => { onClearLocal(); entry.remove(); };

  switch (entry.kind) {
    case 'number': {
      const min = edits?.min ?? entry.min;
      const max = edits?.max ?? entry.max;
      return (
        <div style={rowStyle}>
          <label htmlFor={searchControlId(entry.key, 'min')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{entry.label}</label>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
              <div className="field">
                <label htmlFor={searchControlId(entry.key, 'min')}>Min</label>
                <input
                  id={searchControlId(entry.key, 'min')}
                  className="input"
                  type="text"
                  inputMode="decimal"
                  value={min}
                  onChange={e => onLocalChange({ min: e.target.value })}
                  onBlur={e => { const v = e.currentTarget.value; if (v !== entry.min) entry.commit(v, max); onClearLocal(); }}
                  style={{ backgroundColor: '#FFFFFF' }}
                />
              </div>
              <div className="field">
                <label htmlFor={searchControlId(entry.key, 'max')}>Max</label>
                <input
                  id={searchControlId(entry.key, 'max')}
                  className="input"
                  type="text"
                  inputMode="decimal"
                  value={max}
                  onChange={e => onLocalChange({ max: e.target.value })}
                  onBlur={e => { const v = e.currentTarget.value; if (v !== entry.max) entry.commit(min, v); onClearLocal(); }}
                  style={{ backgroundColor: '#FFFFFF' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: 36, flexShrink: 0 }}>
              <RemoveFilterButton column={removeLabel} onRemove={onRemove} />
            </div>
          </div>
        </div>
      );
    }
    case 'text': {
      const value = edits?.value ?? entry.value;
      return (
        <div style={rowStyle}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{entry.label}</label>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-1)' }}>
            <div className="field" style={{ flex: 1, minWidth: 0 }}>
              <label htmlFor={searchControlId(entry.key)}>Contains</label>
              <input
                id={searchControlId(entry.key)}
                className="input"
                type="text"
                value={value}
                onChange={e => onLocalChange({ value: e.target.value })}
                onBlur={e => { const v = e.currentTarget.value; if (v !== entry.value) entry.commit(v); onClearLocal(); }}
                style={{ backgroundColor: '#FFFFFF' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: 36, flexShrink: 0 }}>
              <RemoveFilterButton column={removeLabel} onRemove={onRemove} />
            </div>
          </div>
        </div>
      );
    }
    case 'state': {
      const value = edits?.state ?? entry.value;
      return (
        <div style={rowStyle}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>State</label>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-1)' }}>
            <div className="field" style={{ flex: 1, minWidth: 0 }}>
              <label htmlFor={searchControlId(entry.key)}>State</label>
              <select
                id={searchControlId(entry.key)}
                className="input"
                value={value}
                onChange={e => { entry.commit(e.target.value); onClearLocal(); }}
                style={{ backgroundColor: '#FFFFFF', cursor: 'pointer', flex: 1, minWidth: 0 }}
              >
                <option value=""></option>
                {US_STATES.map(([code]) => <option key={code} value={code}>{code}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: 36, flexShrink: 0 }}>
              <RemoveFilterButton column={removeLabel} onRemove={onRemove} />
            </div>
          </div>
        </div>
      );
    }
    case 'type': {
      return (
        <div style={rowStyle}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Secondary Type</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <span className="tag tag-neutral" style={{ flex: 1, minWidth: 0 }}>{entry.value}</span>
            <RemoveFilterButton column={removeLabel} onRemove={onRemove} />
          </div>
        </div>
      );
    }
    case 'dateRange': {
      const from = edits?.from ?? entry.from;
      const to = edits?.to ?? entry.to;
      return (
        <div style={rowStyle}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{entry.label}</label>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
              <div className="field">
                <label htmlFor={searchControlId(entry.key, 'from')}>From</label>
                <input
                  id={searchControlId(entry.key, 'from')}
                  className="input"
                  type="date"
                  value={from}
                  onChange={e => onLocalChange({ from: e.target.value })}
                  onBlur={e => { const v = e.currentTarget.value; if (v !== entry.from || (edits?.to != null && edits.to !== entry.to)) entry.commit(v, to); else if (!edits) {}; onClearLocal(); }}
                  style={{ backgroundColor: '#FFFFFF' }}
                />
              </div>
              <div className="field">
                <label htmlFor={searchControlId(entry.key, 'to')}>To</label>
                <input
                  id={searchControlId(entry.key, 'to')}
                  className="input"
                  type="date"
                  value={to}
                  onChange={e => onLocalChange({ to: e.target.value })}
                  onBlur={e => { const v = e.currentTarget.value; if (v !== entry.to || (edits?.from != null && edits.from !== entry.from)) entry.commit(from, v); onClearLocal(); }}
                  style={{ backgroundColor: '#FFFFFF' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: 36, flexShrink: 0 }}>
              <RemoveFilterButton column={removeLabel} onRemove={onRemove} />
            </div>
          </div>
        </div>
      );
    }
    case 'last': {
      const duration = edits?.duration ?? entry.duration;
      const unit = edits?.unit ?? entry.unit;
      return (
        <div style={rowStyle}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{entry.label}</label>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-1)' }}>
            <div className="field" style={{ flex: 1, minWidth: 0 }}>
              <label htmlFor={searchControlId(entry.key, 'duration')}>Last</label>
              <input
                id={searchControlId(entry.key, 'duration')}
                className="input"
                type="text"
                inputMode="numeric"
                value={duration}
                onChange={e => onLocalChange({ duration: e.target.value })}
                onBlur={e => { const v = e.currentTarget.value; if (v !== entry.duration) entry.commit(v, unit); onClearLocal(); }}
                style={{ backgroundColor: '#FFFFFF' }}
              />
            </div>
            <div className="seg" style={{ flexShrink: 0 }}>
              {(['months', 'years'] as const).map(u => (
                <label key={u} className="seg-opt" style={{ width: 'auto' }}>
                  <input
                    type="radio"
                    name={`${entry.key}-unit`}
                    checked={unit === u}
                    onChange={() => { onLocalChange({ unit: u }); entry.commit(duration, u); onClearLocal(); }}
                  />
                  <span>{u === 'months' ? 'Months' : 'Years'}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: 36, flexShrink: 0 }}>
              <RemoveFilterButton column={removeLabel} onRemove={onRemove} />
            </div>
          </div>
        </div>
      );
    }
    default: {
      const _exhaustive: never = entry;
      return _exhaustive;
    }
  }
}
