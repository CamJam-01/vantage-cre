import type { LandSaleFilters, TimeFilter } from './search-params';

export type SearchFilterEntry =
  | { kind: 'number'; key: string; label: string; min: string; max: string; remove: () => void; commit: (min: string, max: string) => void }
  | { kind: 'text'; key: string; label: string; value: string; remove: () => void; commit: (v: string) => void }
  | { kind: 'state'; key: string; value: string; remove: () => void; commit: (v: string) => void }
  | { kind: 'type'; key: string; value: string; remove: () => void }
  | { kind: 'dateRange'; key: string; label: string; from: string; to: string; remove: () => void; commit: (from: string, to: string) => void }
  | { kind: 'last'; key: string; label: string; duration: string; unit: 'months' | 'years'; remove: () => void; commit: (duration: string, unit: 'months' | 'years') => void };

/** Builds the sidebar's applied-filter chips from decoded URL state. Pure so
 * the entries — labels, keys, commit/remove — can be tested without a render. */
export function buildSearchFilterEntries(
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
  if (filters.market !== undefined) {
    entries.push({
      kind: 'text', key: 'market', label: 'Market', value: filters.market,
      remove: () => commit(set({ market: undefined })),
      commit: v => commit(set({ market: v.trim() || undefined })),
    });
  }
  if (filters.county !== undefined) {
    entries.push({
      kind: 'text', key: 'county', label: 'Property County', value: filters.county,
      remove: () => commit(set({ county: undefined })),
      commit: v => commit(set({ county: v.trim() || undefined })),
    });
  }
  if (filters.city !== undefined) {
    entries.push({
      kind: 'text', key: 'city', label: 'Property City', value: filters.city,
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
  if (time?.mode === 'last' && time.duration) {
    entries.push({
      kind: 'last', key: 'time', label: 'Sale Date',
      duration: String(time.duration), unit: time.unit,
      remove: () => commit(set({ time: undefined })),
      commit: (duration, unit) => {
        const n = Number(duration);
        if (!Number.isFinite(n) || n <= 0) { commit(set({ time: undefined })); return; }
        const next: TimeFilter = { mode: 'last', duration: n, unit };
        commit(set({ time: next }));
      },
    });
  } else if (time?.mode === 'range' && (time.from || time.to)) {
    entries.push({
      kind: 'dateRange', key: 'time', label: 'Sale Date',
      from: time.from ?? '', to: time.to ?? '',
      remove: () => commit(set({ time: undefined })),
      commit: (from, to) => commit(set({ time: { mode: 'range', from: from || undefined, to: to || undefined } })),
    });
  }
  return entries;
}
