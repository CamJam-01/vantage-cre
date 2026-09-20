import type { DatabaseKey } from './field-visibility';

export type SalesTable = 'land_sales' | 'improved_sales';
export type SalesPathId = 'land' | 'improved';

export type SalesPath = {
  id: SalesPathId;
  table: SalesTable;
  databaseKey: DatabaseKey;
  basePath: string;
  searchPath: string;
  label: string;
  exportFilename: string;
  importTemplateFilename: string;
};

export const LAND_SALES_PATH: SalesPath = {
  id: 'land',
  table: 'land_sales',
  databaseKey: 'sales',
  basePath: '/land-sales',
  searchPath: '/search/sales/land',
  label: 'Land Sales',
  exportFilename: 'land-sales-export.csv',
  importTemplateFilename: 'land-sales-import-template.csv',
};

export const IMPROVED_SALES_PATH: SalesPath = {
  id: 'improved',
  table: 'improved_sales',
  databaseKey: 'improved-sales',
  basePath: '/improved-sales',
  searchPath: '/search/sales/improved',
  label: 'Improved Sales',
  exportFilename: 'improved-sales-export.csv',
  importTemplateFilename: 'improved-sales-import-template.csv',
};

export const SALES_PATHS: Record<SalesPathId, SalesPath> = {
  land: LAND_SALES_PATH,
  improved: IMPROVED_SALES_PATH,
};

export function salesPathFromId(id: unknown): SalesPath | null {
  if (id === 'land') return LAND_SALES_PATH;
  if (id === 'improved') return IMPROVED_SALES_PATH;
  return null;
}

export function salesPathFromDatabaseKey(key: unknown): SalesPath | null {
  if (key === LAND_SALES_PATH.databaseKey) return LAND_SALES_PATH;
  if (key === IMPROVED_SALES_PATH.databaseKey) return IMPROVED_SALES_PATH;
  return null;
}

/** Scope row selection so Land and Improved checkboxes cannot collide. */
export function selectionFiltersKey(path: SalesPath, filtersKey: string): string {
  return `${path.id}:${filtersKey}`;
}
