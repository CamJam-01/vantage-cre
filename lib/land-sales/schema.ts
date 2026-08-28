import { costarColumnNames, SALE_DATE_RAW_COLUMN } from './costar-fields';
import { costarColumnType, type CostarColumnType } from './costar-column-types';
import { parseFlexibleDate } from './dates';

/** A land-sale record is a header-keyed map of catalog columns, plus the uuid
 * identity carve-out and the optional raw-date system store. A field *is* a
 * header string — there is no second name. */
export type LandSaleInput = {
  columns: Record<string, unknown>;
  saleDateRaw?: string;
};

export type LandSale = LandSaleInput & {
  id: string;
};

export function emptyLandSale(): LandSale {
  return { id: '', columns: {}, saleDateRaw: undefined };
}

function asIsoDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return parseFlexibleDate(text);
}

/** Per-column coercion driven by `costarColumnType`. Forgiving: an unparseable
 * value becomes null rather than an error, so ingest captures the row. */
export function coerceColumnValue(header: string, value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;

  const kind: CostarColumnType = costarColumnType(header);
  switch (kind) {
    case 'text':
      return String(value).trim() || null;
    case 'number': {
      const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,\s]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    case 'date':
      return asIsoDate(value);
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      const s = String(value).trim().toLowerCase();
      if (/^(true|yes)$/.test(s)) return true;
      if (/^(false|no)$/.test(s)) return false;
      return null;
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Coerce a header-keyed bag of raw cells. Unrecognized Sale Date text is
 * preserved on `saleDateRaw` and warned; every other unparseable value is
 * dropped as null. The row itself is never rejected. */
export function coerceLandSaleInput(
  raw: Record<string, unknown>,
  rowNumber?: number,
): { input: LandSaleInput; warnings: string[] } {
  const columns: Record<string, unknown> = {};
  const warnings: string[] = [];
  let saleDateRaw: string | undefined;

  for (const header of costarColumnNames()) {
    const value = raw[header];
    if (header === 'Sale Date') {
      const text = value == null ? '' : String(value).trim();
      const parsed = coerceColumnValue(header, value);
      if (text && parsed == null) {
        saleDateRaw = text;
        columns[header] = null;
        const where = rowNumber != null ? `Row ${rowNumber}, ` : '';
        warnings.push(
          `${where}Sale Date: "${text}" wasn't recognized as a date — imported without a Sale Date and flagged for review.`,
        );
      } else {
        columns[header] = parsed;
      }
      continue;
    }
    columns[header] = coerceColumnValue(header, value);
  }

  return { input: { columns, saleDateRaw }, warnings };
}

export function columnsFromFormData(formData: FormData, hidden: ReadonlySet<string>): LandSaleInput {
  const raw: Record<string, unknown> = {};
  for (const header of costarColumnNames()) {
    if (hidden.has(header)) continue;
    const value = formData.get(header);
    if (typeof value === 'string') raw[header] = value;
  }
  const { input } = coerceLandSaleInput(raw);
  // coerce fills every catalog column; drop hidden keys so they are absent,
  // not null — merge/create must not treat them as submitted values.
  for (const header of hidden) {
    delete input.columns[header];
  }
  return input;
}

export function columnInputValue(record: LandSale, header: string): string {
  if (header === 'Sale Date') {
    const typed = record.columns['Sale Date'];
    if (typed != null && typed !== '') return toInputString(typed);
    return record.saleDateRaw ?? '';
  }
  return toInputString(record.columns[header]);
}

export function toInputString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text;
}

export function fieldInputId(header: string): string {
  return `field-${header.replaceAll(/[^a-zA-Z0-9]+/g, '-')}`;
}

export function isSystemColumn(name: string): boolean {
  return name === 'id' || name === SALE_DATE_RAW_COLUMN;
}
