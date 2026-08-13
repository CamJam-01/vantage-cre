'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tag } from '@/components/ui/tag';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { PROPERTY_TYPES, US_STATES, type PropertyType } from '@/lib/land-sales/constants';
import { encodeFilters, type LandSaleFilters, type TimeFilter } from '@/lib/land-sales/search-params';
import { formatInputWithCommas, parseFormattedNumber } from '@/lib/land-sales/format';

type SizeMode = 'sf' | 'ac';
type TimeMode = 'last' | 'range';

type LocalState = {
  state: string; msa: string; county: string; city: string; types: PropertyType[];
  sizeMode: SizeMode; sfMin: string; sfMax: string; acMin: string; acMax: string;
  timeMode: TimeMode; lastDuration: string; lastUnit: 'months' | 'years'; dateFrom: string; dateTo: string;
};

function fromFilters(filters: LandSaleFilters): LocalState {
  return {
    state: filters.state ?? '', msa: filters.msa ?? '', county: filters.county ?? '', city: filters.city ?? '',
    types: filters.types,
    sizeMode: filters.acMin != null || filters.acMax != null ? 'ac' : 'sf',
    sfMin: filters.sfMin != null ? String(filters.sfMin) : '',
    sfMax: filters.sfMax != null ? String(filters.sfMax) : '',
    acMin: filters.acMin != null ? String(filters.acMin) : '',
    acMax: filters.acMax != null ? String(filters.acMax) : '',
    timeMode: filters.time?.mode === 'range' ? 'range' : 'last',
    lastDuration: filters.time?.mode === 'last' ? String(filters.time.duration) : '',
    lastUnit: filters.time?.mode === 'last' ? filters.time.unit : 'months',
    dateFrom: filters.time?.mode === 'range' ? filters.time.from ?? '' : '',
    dateTo: filters.time?.mode === 'range' ? filters.time.to ?? '' : '',
  };
}

function toFilters(s: LocalState): LandSaleFilters {
  let time: TimeFilter | undefined;
  if (s.timeMode === 'last' && s.lastDuration) {
    time = { mode: 'last', duration: Number(s.lastDuration), unit: s.lastUnit };
  } else if (s.timeMode === 'range' && (s.dateFrom || s.dateTo)) {
    time = { mode: 'range', from: s.dateFrom || undefined, to: s.dateTo || undefined };
  }
  return {
    state: s.state || undefined,
    msa: s.msa.trim() || undefined,
    county: s.county.trim() || undefined,
    city: s.city.trim() || undefined,
    types: s.types,
    sfMin: s.sizeMode === 'sf' ? parseFormattedNumber(s.sfMin) : undefined,
    sfMax: s.sizeMode === 'sf' ? parseFormattedNumber(s.sfMax) : undefined,
    acMin: s.sizeMode === 'ac' ? parseFormattedNumber(s.acMin) : undefined,
    acMax: s.sizeMode === 'ac' ? parseFormattedNumber(s.acMax) : undefined,
    time,
  };
}

const DEBOUNCE_MS = 450;

/** Quick-tweak filters for the results page — full parity with the search page's
 * filter set. Select/tag/mode changes apply immediately; free-text and numeric
 * fields debounce so we don't re-query on every keystroke.
 *
 * `filters` changes on every navigation, including the ones this component
 * causes via its own debounced `router.replace`. Re-deriving `local` in an
 * effect would remount-free but still fire a render after the URL updates —
 * fine on its own, except a `key`-remount would drop focus mid-typing. Instead
 * we adjust state during render (React's documented pattern for this) keyed
 * off the encoded filters string, which re-syncs on real external navigation
 * (e.g. arriving fresh from the search page) while leaving the input's focus
 * and DOM node untouched on our own commits. */
export function FiltersSidebar({ filters }: { filters: LandSaleFilters }) {
  const router = useRouter();
  const filtersKey = encodeFilters(filters).toString();
  const [local, setLocal] = useState<LocalState>(() => fromFilters(filters));
  const [syncedKey, setSyncedKey] = useState(filtersKey);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (filtersKey !== syncedKey) {
    setSyncedKey(filtersKey);
    setLocal(fromFilters(filters));
  }

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function commit(next: LocalState, opts: { immediate?: boolean } = {}) {
    setLocal(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    const apply = () => router.replace(`/land-sales?${encodeFilters(toFilters(next)).toString()}`);
    if (opts.immediate) apply();
    else timerRef.current = setTimeout(apply, DEBOUNCE_MS);
  }

  function toggleType(t: PropertyType) {
    const types = local.types.includes(t) ? local.types.filter(x => x !== t) : [...local.types, t];
    commit({ ...local, types }, { immediate: true });
  }

  return (
    <aside className="blueprint elev-sm" style={{
      position: 'sticky', top: 88, alignSelf: 'flex-start', flexShrink: 0,
      minWidth: 275, maxWidth: 325, width: '25%', maxHeight: 'calc(100vh - 112px)', overflowY: 'auto',
      boxSizing: 'border-box', padding: 10, background: 'var(--color-neutral-100)',
    }}>
      <div style={{ paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-neutral-300)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>Search Filters</span>
        <Link href="/search/sales/land" style={{ fontSize: 13, fontWeight: 600 }}>Modify Search</Link>
      </div>

      <div style={{ paddingTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        <div className="field">
          <label htmlFor="filter-state">State</label>
          <select id="filter-state" className="input" value={local.state} onChange={e => commit({ ...local, state: e.target.value }, { immediate: true })} style={{ backgroundColor: '#FFFFFF', cursor: 'pointer' }}>
            <option value="">Any state</option>
            {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="filter-msa">MSA</label>
          <input id="filter-msa" className="input" type="text" value={local.msa} onChange={e => commit({ ...local, msa: e.target.value })} style={{ backgroundColor: '#FFFFFF' }} />
        </div>

        <div className="field">
          <label htmlFor="filter-county">County</label>
          <input id="filter-county" className="input" type="text" value={local.county} onChange={e => commit({ ...local, county: e.target.value })} style={{ backgroundColor: '#FFFFFF' }} />
        </div>

        <div className="field">
          <label htmlFor="filter-city">City</label>
          <input id="filter-city" className="input" type="text" value={local.city} onChange={e => commit({ ...local, city: e.target.value })} style={{ backgroundColor: '#FFFFFF' }} />
        </div>

        <div style={{ borderTop: '1px solid var(--color-neutral-300)', paddingTop: 'var(--space-4)' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)', marginBottom: 'var(--space-2)' }}>Type</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {PROPERTY_TYPES.map(t => {
              const selected = local.types.includes(t);
              return (
                <Tag
                  key={t}
                  onClick={() => toggleType(t)}
                  style={{
                    background: selected ? 'var(--color-accent-600)' : '#FFFFFF',
                    color: selected ? '#FFFFFF' : 'var(--color-neutral-900)',
                    border: `1px solid ${selected ? 'var(--color-accent-600)' : 'var(--color-neutral-400)'}`,
                    cursor: 'pointer', fontSize: 12,
                  }}
                >
                  {t}
                </Tag>
              );
            })}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--color-neutral-300)', paddingTop: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>
              Size ({local.sizeMode === 'sf' ? 'Square Feet' : 'Acreage'})
            </label>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => commit({ ...local, sizeMode: local.sizeMode === 'sf' ? 'ac' : 'sf' }, { immediate: true })}
              style={{ cursor: 'pointer', fontSize: 11, textDecorationLine: 'underline', padding: 0 }}
            >
              {local.sizeMode === 'sf' ? 'Use Acreage' : 'Use Square Feet'}
            </button>
          </div>
          {local.sizeMode === 'sf' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div className="field"><label>Min</label><input className="input" type="text" inputMode="numeric" value={local.sfMin} onChange={e => commit({ ...local, sfMin: formatInputWithCommas(e.target.value) })} style={{ backgroundColor: '#FFFFFF' }} /></div>
              <div className="field"><label>Max</label><input className="input" type="text" inputMode="numeric" value={local.sfMax} onChange={e => commit({ ...local, sfMax: formatInputWithCommas(e.target.value) })} style={{ backgroundColor: '#FFFFFF' }} /></div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div className="field"><label>Min</label><input className="input" type="text" inputMode="decimal" value={local.acMin} onChange={e => commit({ ...local, acMin: formatInputWithCommas(e.target.value) })} style={{ backgroundColor: '#FFFFFF' }} /></div>
              <div className="field"><label>Max</label><input className="input" type="text" inputMode="decimal" value={local.acMax} onChange={e => commit({ ...local, acMax: formatInputWithCommas(e.target.value) })} style={{ backgroundColor: '#FFFFFF' }} /></div>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--color-neutral-300)', paddingTop: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>
              Time ({local.timeMode === 'last' ? 'Last' : 'Range'})
            </label>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => commit({ ...local, timeMode: local.timeMode === 'last' ? 'range' : 'last' }, { immediate: true })}
              style={{ cursor: 'pointer', fontSize: 11, textDecorationLine: 'underline', padding: 0 }}
            >
              {local.timeMode === 'last' ? 'Use Range' : 'Use Last'}
            </button>
          </div>
          {local.timeMode === 'last' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', alignItems: 'end' }}>
              <div className="field"><label>Duration</label><input className="input" type="number" value={local.lastDuration} onChange={e => commit({ ...local, lastDuration: e.target.value })} style={{ backgroundColor: '#FFFFFF' }} /></div>
              <SegmentedControl
                name="filter-last-unit"
                value={local.lastUnit}
                onChange={v => commit({ ...local, lastUnit: v as 'months' | 'years' }, { immediate: true })}
                options={[{ label: 'Months', value: 'months' }, { label: 'Years', value: 'years' }]}
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div className="field"><label>From</label><input className="input" type="date" value={local.dateFrom} onChange={e => commit({ ...local, dateFrom: e.target.value }, { immediate: true })} style={{ backgroundColor: '#FFFFFF' }} /></div>
              <div className="field"><label>To</label><input className="input" type="date" value={local.dateTo} onChange={e => commit({ ...local, dateTo: e.target.value }, { immediate: true })} style={{ backgroundColor: '#FFFFFF' }} /></div>
            </div>
          )}
        </div>

      </div>
    </aside>
  );
}
