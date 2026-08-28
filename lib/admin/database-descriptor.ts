/** Static descriptors backing the admin Database Manager screens.
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
