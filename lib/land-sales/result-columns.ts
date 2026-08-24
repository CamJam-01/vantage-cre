import { costarColumnNames } from './costar-fields';
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

export const CORE_RESULT_COLUMNS: Extract<ResultColumn, { kind: 'core' }>[] = [
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

/** Record-details layout — the "Sales Record Blueprint" drafting sheets. Each
 * sheet is a tab; each section is a labelled band inside the sheet's 12-column
 * grid, and `span` is that column count. Both sheets stay mounted while editing
 * (the inactive one is hidden, not unmounted) so a save submits every field, so
 * a given core field must appear exactly once across the whole set — a repeat
 * would submit two values under the same input name. */
export type DetailField = { key: CoreResultField; label: string; span: number };

export type DetailSection = { label?: string; fields: DetailField[] };

export type DetailSheet = { id: string; tab: string; title: string; sections: DetailSection[] };

export const DETAIL_SHEETS: DetailSheet[] = [
  {
    id: 'description',
    tab: 'Property Description',
    title: 'Property Description',
    sections: [
      {
        fields: [
          { key: 'parcel_id', label: 'Parcel ID', span: 3 },
          { key: 'address', label: 'Address', span: 9 },
          { key: 'city', label: 'City', span: 4 },
          { key: 'state', label: 'State', span: 2 },
          { key: 'county', label: 'County', span: 6 },
        ],
      },
      {
        label: 'Site Area',
        fields: [
          { key: 'acreage', label: 'Acreage', span: 6 },
          { key: 'square_feet', label: 'Square Feet', span: 6 },
        ],
      },
      {
        label: 'Classification',
        fields: [
          { key: 'property_type', label: 'Property Type', span: 6 },
          { key: 'msa', label: 'MSA', span: 6 },
        ],
      },
    ],
  },
  {
    id: 'transaction',
    tab: 'Transaction',
    title: 'Transaction',
    sections: [
      {
        fields: [
          { key: 'sale_date', label: 'Sale Date', span: 4 },
          { key: 'sale_price', label: 'Sale Price', span: 4 },
          { key: 'price_per_acre', label: 'Price / Acre', span: 4 },
          { key: 'buyer', label: 'Buyer', span: 12 },
        ],
      },
    ],
  },
];

/** Price / Acre is derived from price and acreage server-side, so it renders
 * read-only even on the edit sheet. */
export const DETAIL_COMPUTED_FIELDS: CoreResultField[] = ['price_per_acre'];

export function detailSheetFields(sheet: DetailSheet): DetailField[] {
  return sheet.sections.flatMap(section => section.fields);
}

export function resultColumns(options: {
  catalogLabels?: string[];
  /** Ignored. Result columns are the unique land_sales / CoStar headers. */
  records?: Array<{ extras?: Record<string, string> }>;
} = {}): ResultColumn[] {
  void options.catalogLabels;
  void options.records;
  return costarColumnNames().map(label => ({ kind: 'extra', key: label, label }));
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
