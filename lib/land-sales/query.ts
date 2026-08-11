import type { SupabaseClient } from '@supabase/supabase-js';
import type { LandSaleFilters } from './search-params';

function lastDurationToDate(duration: number, unit: 'months' | 'years'): string | null {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const d = new Date();
  if (unit === 'months') d.setMonth(d.getMonth() - duration);
  else d.setFullYear(d.getFullYear() - duration);
  return d.toISOString().slice(0, 10);
}

/** Translates decoded URL filters into a Supabase query. Shared by the results page
 * (fetch) and the CSV-duplicate check during import (count-only). */
export function applyLandSaleFilters(
  supabase: SupabaseClient,
  filters: LandSaleFilters
) {
  let query = supabase.from('land_sales').select('*').order('sale_date', { ascending: false });

  if (filters.state) query = query.eq('state', filters.state);
  if (filters.county) query = query.ilike('county', `%${filters.county}%`);
  if (filters.city) query = query.ilike('city', `%${filters.city}%`);
  if (filters.msa) query = query.ilike('msa', `%${filters.msa}%`);
  if (filters.types.length) query = query.in('property_type', filters.types);
  if (filters.sfMin != null) query = query.gte('square_feet', filters.sfMin);
  if (filters.sfMax != null) query = query.lte('square_feet', filters.sfMax);
  if (filters.acMin != null) query = query.gte('acreage', filters.acMin);
  if (filters.acMax != null) query = query.lte('acreage', filters.acMax);

  if (filters.time?.mode === 'range') {
    if (filters.time.from) query = query.gte('sale_date', filters.time.from);
    if (filters.time.to) query = query.lte('sale_date', filters.time.to);
  } else if (filters.time?.mode === 'last') {
    const from = lastDurationToDate(filters.time.duration, filters.time.unit);
    if (from) query = query.gte('sale_date', from);
  }

  return query;
}
