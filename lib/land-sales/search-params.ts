import { PROPERTY_TYPES, type PropertyType } from './constants';

export type TimeFilter =
  | { mode: 'last'; duration: number; unit: 'months' | 'years' }
  | { mode: 'range'; from?: string; to?: string };

export type LandSaleFilters = {
  state?: string;
  msa?: string;
  county?: string;
  city?: string;
  types: PropertyType[];
  sfMin?: number;
  sfMax?: number;
  acMin?: number;
  acMax?: number;
  time?: TimeFilter;
};

export const emptyFilters: LandSaleFilters = { types: [] };

export function encodeFilters(filters: LandSaleFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.state) params.set('state', filters.state);
  if (filters.msa) params.set('msa', filters.msa);
  if (filters.county) params.set('county', filters.county);
  if (filters.city) params.set('city', filters.city);
  for (const t of filters.types) params.append('type', t);
  if (filters.sfMin != null) params.set('sfMin', String(filters.sfMin));
  if (filters.sfMax != null) params.set('sfMax', String(filters.sfMax));
  if (filters.acMin != null) params.set('acMin', String(filters.acMin));
  if (filters.acMax != null) params.set('acMax', String(filters.acMax));
  if (filters.time?.mode === 'last') {
    params.set('lastDuration', String(filters.time.duration));
    params.set('lastUnit', filters.time.unit);
  } else if (filters.time?.mode === 'range') {
    if (filters.time.from) params.set('dateFrom', filters.time.from);
    if (filters.time.to) params.set('dateTo', filters.time.to);
  }
  return params;
}

type SearchParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

function toURLSearchParams(input: SearchParamsInput): URLSearchParams {
  if (input instanceof URLSearchParams) return input;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach(v => params.append(key, v));
    else params.set(key, value);
  }
  return params;
}

export function decodeFilters(input: SearchParamsInput): LandSaleFilters {
  const params = toURLSearchParams(input);

  const types = params.getAll('type').filter((t): t is PropertyType =>
    (PROPERTY_TYPES as readonly string[]).includes(t)
  );

  const num = (key: string): number | undefined => {
    const v = params.get(key);
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  let time: TimeFilter | undefined;
  const lastDuration = num('lastDuration');
  const lastUnit = params.get('lastUnit');
  const dateFrom = params.get('dateFrom') ?? undefined;
  const dateTo = params.get('dateTo') ?? undefined;
  if (lastDuration != null && (lastUnit === 'months' || lastUnit === 'years')) {
    time = { mode: 'last', duration: lastDuration, unit: lastUnit };
  } else if (dateFrom || dateTo) {
    time = { mode: 'range', from: dateFrom, to: dateTo };
  }

  return {
    state: params.get('state') ?? undefined,
    msa: params.get('msa') ?? undefined,
    county: params.get('county') ?? undefined,
    city: params.get('city') ?? undefined,
    types,
    sfMin: num('sfMin'),
    sfMax: num('sfMax'),
    acMin: num('acMin'),
    acMax: num('acMax'),
    time,
  };
}

export function hasAnyFilter(filters: LandSaleFilters): boolean {
  return Boolean(
    filters.state || filters.msa || filters.county || filters.city ||
    filters.types.length || filters.sfMin != null || filters.sfMax != null ||
    filters.acMin != null || filters.acMax != null || filters.time
  );
}
