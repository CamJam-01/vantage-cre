import type { LandSale } from './schema';

export type CoreResultField =
  | 'parcel_id'
  | 'address'
  | 'city'
  | 'county'
  | 'state'
  | 'msa'
  | 'property_type'
  | 'sale_date'
  | 'acreage'
  | 'square_feet'
  | 'sale_price'
  | 'price_per_acre'
  | 'buyer';

export type ResultColumn =
  | { kind: 'core'; key: CoreResultField; label: string }
  | { kind: 'extra'; key: string; label: string };

const CORE_RESULT_COLUMNS: Extract<ResultColumn, { kind: 'core' }>[] = [
  { kind: 'core', key: 'parcel_id', label: 'Parcel ID' },
  { kind: 'core', key: 'address', label: 'Address' },
  { kind: 'core', key: 'city', label: 'City' },
  { kind: 'core', key: 'county', label: 'County' },
  { kind: 'core', key: 'state', label: 'State' },
  { kind: 'core', key: 'msa', label: 'MSA' },
  { kind: 'core', key: 'property_type', label: 'Type' },
  { kind: 'core', key: 'sale_date', label: 'Sale Date' },
  { kind: 'core', key: 'acreage', label: 'Acreage' },
  { kind: 'core', key: 'square_feet', label: 'Square Feet' },
  { kind: 'core', key: 'sale_price', label: 'Sale Price' },
  { kind: 'core', key: 'price_per_acre', label: 'Price / Acre' },
  { kind: 'core', key: 'buyer', label: 'Buyer' },
];

export function resultColumns(options: {
  catalogLabels?: string[];
  records?: Array<{ extras?: Record<string, string> }>;
} = {}): ResultColumn[] {
  const labels = new Set<string>(options.catalogLabels ?? []);
  for (const row of options.records ?? []) {
    for (const key of Object.keys(row.extras ?? {})) labels.add(key);
  }
  const extras: Extract<ResultColumn, { kind: 'extra' }>[] = [...labels]
    .sort((a, b) => a.localeCompare(b))
    .map(label => ({ kind: 'extra', key: label, label }));
  return [...CORE_RESULT_COLUMNS, ...extras];
}

export function resultSortValue(
  record: Pick<LandSale, CoreResultField> & { extras?: Record<string, string> },
  column: ResultColumn,
): string | number | null {
  switch (column.kind) {
    case 'core': {
      const value = record[column.key];
      return value == null || value === '' ? null : value;
    }
    case 'extra': {
      const value = record.extras?.[column.key];
      return value == null || value === '' ? null : value;
    }
    default: {
      const _exhaustive: never = column;
      return _exhaustive;
    }
  }
}
