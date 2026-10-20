import {
  costarColumnNames,
  costarFields,
  RECORD_IMAGE_CAPTION_COLUMN,
  RECORD_IMAGE_COLUMN,
  SALE_DATE_RAW_COLUMN,
} from './costar-fields';
import { normalizeRecordImageCaption } from './record-image';
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
  const imagePath = row[RECORD_IMAGE_COLUMN];
  return {
    id,
    columns,
    saleDateRaw: typeof raw === 'string' && raw.trim() ? raw.trim() : undefined,
    recordImagePath: typeof imagePath === 'string' && imagePath.trim() ? imagePath.trim() : undefined,
    recordImageCaption: normalizeRecordImageCaption(row[RECORD_IMAGE_CAPTION_COLUMN]),
  };
}

/** Results-table projection: keep identity and system stores, drop catalog
 * values the Admin has hidden. Export re-fetches the full row; this must never
 * be the export path. */
export function projectVisibleLandSale(record: LandSale, visible: ReadonlySet<string>): LandSale {
  const columns: Record<string, unknown> = {};
  for (const name of visible) {
    columns[name] = record.columns[name] ?? null;
  }
  return {
    id: record.id,
    columns,
    saleDateRaw: record.saleDateRaw,
    recordImagePath: record.recordImagePath,
    recordImageCaption: record.recordImageCaption,
  };
}

/** Write a record back onto sales columns, including the raw-date store and
 * image caption. Image *path* is updated by its own Server Action so a catalog
 * Save cannot clear an attached photo. */
export function landSaleToRow(input: LandSaleInput): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  for (const name of costarColumnNames()) {
    columns[name] = input.columns[name] ?? null;
  }
  columns[SALE_DATE_RAW_COLUMN] = input.saleDateRaw ?? null;
  columns[RECORD_IMAGE_CAPTION_COLUMN] = input.recordImageCaption ?? null;
  return columns;
}

/** Walk the selected CSV sequence into named columns. Duplicate positions
 * share one column and the last value wins (README §3A). */
export function costarTextValues(values: string[], headers?: readonly string[]): Record<string, string | null> {
  const columns: Record<string, string | null> = {};
  costarFields(headers).forEach((field, index) => {
    const raw = (values[index] ?? '').trim();
    columns[field.column] = raw ? raw : null;
  });
  return columns;
}
