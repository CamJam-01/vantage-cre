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
  { name: 'parcel_id', type: 'Text', required: false, visibleInSearch: false },
  { name: 'address', type: 'Text', required: false, visibleInSearch: false },
  { name: 'city', type: 'Text', required: false, visibleInSearch: true },
  { name: 'county', type: 'Text', required: false, visibleInSearch: true },
  { name: 'state', type: 'Text', required: false, visibleInSearch: true },
  { name: 'msa', type: 'Text', required: false, visibleInSearch: true },
  { name: 'property_type', type: 'Text', required: false, visibleInSearch: true },
  { name: 'square_feet', type: 'Number', required: false, visibleInSearch: true },
  { name: 'acreage', type: 'Number', required: false, visibleInSearch: true },
  { name: 'sale_date', type: 'Date', required: false, visibleInSearch: true },
  { name: 'sale_price', type: 'Currency', required: false, visibleInSearch: false },
  { name: 'buyer', type: 'Text', required: false, visibleInSearch: false },
  { name: 'price_per_acre', type: 'Currency', required: false, visibleInSearch: false },
];
