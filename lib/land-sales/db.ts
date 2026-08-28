import { costarColumnNames, costarFields, SALE_DATE_RAW_COLUMN } from './costar-fields';
import type { LandSale, LandSaleInput } from './schema';

function asString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

/** Map a land_sales row onto the app record. Fail closed when the uuid `id` is
 * missing — Comp ID is not unique and must never stand in for row identity. */
export function landSaleFromRow(row: Record<string, unknown>): LandSale | null {
  const id = asString(row.id);
  if (!id) return null;

  const columns: Record<string, unknown> = {};
  for (const name of costarColumnNames()) {
    columns[name] = row[name] ?? null;
  }
  const raw = row[SALE_DATE_RAW_COLUMN];
  return {
    id,
    columns,
    saleDateRaw: typeof raw === 'string' && raw.trim() ? raw.trim() : undefined,
  };
}

/** Results-table projection: keep identity and the raw-date flag, drop catalog
 * values the Admin has hidden. Export re-fetches the full row; this must never
 * be the export path. */
export function projectVisibleLandSale(record: LandSale, visible: ReadonlySet<string>): LandSale {
  const columns: Record<string, unknown> = {};
  for (const name of visible) {
    columns[name] = record.columns[name] ?? null;
  }
  return { id: record.id, columns, saleDateRaw: record.saleDateRaw };
}

/** Write a record back onto land_sales columns, including the raw-date store.
 * Catalog headers only — system columns other than `_sale_date_raw` stay out. */
export function landSaleToRow(input: LandSaleInput): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  for (const name of costarColumnNames()) {
    columns[name] = input.columns[name] ?? null;
  }
  columns[SALE_DATE_RAW_COLUMN] = input.saleDateRaw ?? null;
  return columns;
}

/** Walk the 278 header positions into the 277 columns. Positions 259 and 260
 * both write `Sprinklers`, so the second value wins — accepted known lossiness
 * (README §3A); do not add a column without a §5 decision. */
export function costarTextValues(values: string[]): Record<string, string | null> {
  const columns: Record<string, string | null> = {};
  costarFields().forEach((field, index) => {
    const raw = (values[index] ?? '').trim();
    columns[field.column] = raw ? raw : null;
  });
  return columns;
}
