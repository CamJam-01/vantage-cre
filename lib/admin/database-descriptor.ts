/** Static descriptors backing the admin Database Manager / Schema screens.
 * Only "Land Sales" maps to a real table (land_sales); the rest mirror the
 * "coming in a later phase" categories used throughout the rest of the app. */

export type DatabaseCategory = {
  key: 'sales' | 'rentals' | 'expenses' | 'costs';
  name: string;
  table: string | null;
  available: boolean;
};

export const DATABASE_CATEGORIES: DatabaseCategory[] = [
  { key: 'sales', name: 'Land Sales', table: 'land_sales', available: true },
  { key: 'rentals', name: 'Rentals', table: null, available: false },
  { key: 'expenses', name: 'Expenses', table: null, available: false },
  { key: 'costs', name: 'Costs', table: null, available: false },
];

export type FieldDescriptor = {
  name: string;
  type: 'Text' | 'Number' | 'Currency' | 'Date';
  required: boolean;
  visibleInSearch: boolean;
  custom?: boolean;
};

export function customFieldDescriptor(label: string): FieldDescriptor {
  return { name: label, type: 'Text', required: false, visibleInSearch: false, custom: true };
}

/** Reflects land_sales' actual columns/constraints as of the current schema —
 * this is a read-only display, not a live introspection, per the "Land Sales
 * only, read-only view" scoping decision (no live add/edit/delete field yet). */
export const LAND_SALES_FIELDS: FieldDescriptor[] = [
  { name: 'Parcel Number 1 (Min)', type: 'Text', required: false, visibleInSearch: false },
  { name: 'Property Address', type: 'Text', required: false, visibleInSearch: false },
  { name: 'Property City', type: 'Text', required: false, visibleInSearch: true },
  { name: 'Property County', type: 'Text', required: false, visibleInSearch: true },
  { name: 'Property State', type: 'Text', required: false, visibleInSearch: true },
  { name: 'Market', type: 'Text', required: false, visibleInSearch: true },
  { name: 'Property Type', type: 'Text', required: false, visibleInSearch: true },
  { name: 'Land Area SF', type: 'Number', required: false, visibleInSearch: true },
  { name: 'Land Area AC', type: 'Number', required: false, visibleInSearch: true },
  { name: 'Sale Date', type: 'Date', required: false, visibleInSearch: true },
  { name: 'Sale Price', type: 'Currency', required: false, visibleInSearch: false },
  { name: 'Buyer (True) Company', type: 'Text', required: false, visibleInSearch: false },
];
