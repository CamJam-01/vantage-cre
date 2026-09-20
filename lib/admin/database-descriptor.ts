/** Static descriptors backing the admin Database Manager screens.
 * Land Sales and Improved Sales map to real tables; the rest mirror the
 * "coming in a later phase" categories used throughout the rest of the app. */

export type DatabaseCategoryKey = 'sales' | 'improved-sales' | 'rentals' | 'expenses' | 'costs';

export type DatabaseCategory = {
  key: DatabaseCategoryKey;
  name: string;
  table: string | null;
  available: boolean;
};

export const DATABASE_CATEGORIES: DatabaseCategory[] = [
  { key: 'sales', name: 'Land Sales', table: 'land_sales', available: true },
  { key: 'improved-sales', name: 'Improved Sales', table: 'improved_sales', available: true },
  { key: 'rentals', name: 'Rentals', table: null, available: false },
  { key: 'expenses', name: 'Expenses', table: null, available: false },
  { key: 'costs', name: 'Costs', table: null, available: false },
];
