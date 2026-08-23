import { costarFields } from './costar-fields';
import type { LandSale, LandSaleInput } from './schema';

function asString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function asNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function asDate(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : undefined;
}

function emptyToNull(value: string): string | null {
  return value ? value : null;
}

/** Map a land_sales row (CoStar column names) onto the app's LandSale shape. */
export function landSaleFromRow(row: Record<string, unknown>): LandSale {
  const acreage = asNumber(row['Land Area AC']);
  const salePrice = asNumber(row['Sale Price']);
  const rawState = asString(row['Property State']);
  const state = rawState.length === 2 ? rawState.toUpperCase() : '';
  const pricePerAcre = acreage && acreage > 0 && salePrice != null
    ? Math.round((salePrice / acreage) * 100) / 100
    : null;

  return {
    id: String(row.id ?? ''),
    parcel_id: asString(row['Parcel Number 1 (Min)']),
    address: asString(row['Property Address']),
    city: asString(row['Property City']),
    county: asString(row['Property County']),
    state,
    msa: asString(row['Market']) || undefined,
    property_type: asString(row['Property Type']),
    square_feet: asNumber(row['Land Area SF']),
    acreage,
    sale_date: asDate(row['Sale Date']),
    sale_date_raw: undefined,
    sale_price: salePrice,
    buyer: asString(row['Buyer (True) Company']),
    extras: {},
    price_per_acre: pricePerAcre,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

/** Map a form/import LandSale onto CoStar land_sales columns. */
export function landSaleToRow(input: LandSaleInput): Record<string, unknown> {
  return {
    'Parcel Number 1 (Min)': emptyToNull(input.parcel_id),
    'Property Address': emptyToNull(input.address),
    'Property City': emptyToNull(input.city),
    'Property County': emptyToNull(input.county),
    'Property State': emptyToNull(input.state),
    'Market': input.msa ? input.msa : null,
    'Property Type': emptyToNull(input.property_type),
    'Land Area SF': input.square_feet ?? null,
    'Land Area AC': input.acreage ?? null,
    'Sale Date': input.sale_date ?? null,
    'Sale Price': input.sale_price ?? null,
    'Buyer (True) Company': emptyToNull(input.buyer),
  };
}

export function costarTextValues(values: string[]): Record<string, string | null> {
  const columns: Record<string, string | null> = {};
  costarFields().forEach((field, index) => {
    const raw = (values[index] ?? '').trim();
    columns[field.column] = raw ? raw : null;
  });
  return columns;
}
