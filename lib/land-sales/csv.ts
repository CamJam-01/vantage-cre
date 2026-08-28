import { COSTAR_HEADER_ROW, COSTAR_HEADERS, SALE_DATE_RAW_COLUMN } from './costar-fields';
import { costarTextValues, landSaleToRow } from './db';
import { coerceLandSaleInput, type LandSale, type LandSaleInput } from './schema';

export const csvHeaders = COSTAR_HEADERS;

export function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCellValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text;
}

function saleDateExport(record: LandSale): string {
  const typed = record.columns['Sale Date'];
  if (typed != null && typed !== '') return exportCellValue(typed);
  return record.saleDateRaw ?? '';
}

/** Export-side CSV builder. Always emits all 278 header positions in
 * canonical order; display configuration cannot change the file. */
export function makeCsv(rows: LandSale[]): string {
  const body = rows.map(row => {
    const columns = landSaleToRow(row);
    return COSTAR_HEADERS.map(name => {
      if (name === 'Sale Date') return csvCell(saleDateExport(row));
      return csvCell(exportCellValue(columns[name]));
    }).join(',');
  });
  return [COSTAR_HEADER_ROW, ...body].join('\r\n');
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import template: header row plus one blank data row so an unmodified
 * template uploads as a single empty record. */
export function makeCsvTemplate(): string {
  return [COSTAR_HEADER_ROW, COSTAR_HEADERS.map(() => '').join(',')].join('\r\n');
}

/** RFC4180-ish CSV tokenizer: handles quoted fields with embedded commas,
 * newlines, and escaped ("") quotes. Shared by client-side pre-validation
 * and the server action's re-validation of the same file. */
export function parseCsv(text: string): string[][] {
  // Strip a leading UTF-8 BOM — common on CSVs exported from Excel — so it
  // doesn't get glued onto the first header's name and break matching.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        quoted = false; i += 1; continue;
      }
      cell += char; i += 1; continue;
    }
    if (char === '"') { quoted = true; i += 1; continue; }
    if (char === ',') { row.push(cell); cell = ''; i += 1; continue; }
    if (char === '\r') { i += 1; continue; }
    if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i += 1; continue; }
    cell += char; i += 1;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
}

/** Catches the classic "exported with semicolons/tabs instead of commas" case
 * early: parseCsv would otherwise read the whole header line as one column,
 * and every row would then fail validation on nearly every field at once. */
export function looksLikeWrongDelimiter(headers: string[]): boolean {
  return headers.length === 1 && /[;\t]/.test(headers[0]);
}

export function headersMatchExactly(headers: string[]): boolean {
  if (headers.length !== csvHeaders.length) return false;
  return headers.every((h, i) => h.trim().toLowerCase() === csvHeaders[i].toLowerCase());
}

/** Import only accepts the template header row. Extra or renamed columns are
 * rejected rather than mapped or turned into new database fields. */
export function csvHeaderError(headers: string[]): string | undefined {
  if (headersMatchExactly(headers)) return undefined;
  return `CSV headers must match the import template exactly (${csvHeaders.length} columns).`;
}

export type ImportRowResult =
  | { row: number; ok: true; data: LandSaleInput; columns: Record<string, string | null>; warnings?: string[] }
  | { row: number; ok: false; errors: string[] };

/** Merge coerced typed values onto the CSV text columns for a land_sales insert.
 * `_sale_date_raw` is written only when Sale Date was unrecognized. */
export function importLandSaleRow(row: Extract<ImportRowResult, { ok: true }>): Record<string, unknown> {
  return {
    ...row.columns,
    ...row.data.columns,
    [SALE_DATE_RAW_COLUMN]: row.data.saleDateRaw ?? null,
  };
}

/** Validates template-ordered CoStar data rows. Unparseable cells become null
 * with a warning (Sale Date keeps its original text); the row is never rejected
 * for a value the type cannot understand. */
export function validateDataRows(rows: string[][]): ImportRowResult[] {
  return rows.map((values, index) => {
    const rowNumber = index + 2;
    const textColumns = costarTextValues(values);
    const { input, warnings } = coerceLandSaleInput(textColumns, rowNumber);
    return {
      row: rowNumber,
      ok: true as const,
      data: input,
      columns: textColumns,
      warnings: warnings.length ? warnings : undefined,
    };
  });
}

function keyPart(value: unknown): string {
  if (value == null) return '';
  const text = String(value).trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text;
}

/** Dedupe fingerprint — Parcel Number 1 (Min), Sale Date, Property Address.
 * Likely duplicates are reported, never silently skipped or merged. */
export const RECORD_KEY_COLUMNS = [
  'Parcel Number 1 (Min)',
  'Sale Date',
  'Property Address',
] as const;

export function recordKey(columns: Record<string, unknown>): string {
  return RECORD_KEY_COLUMNS.map(name => keyPart(columns[name])).join('|');
}

export function duplicateLabel(columns: Record<string, unknown>): string {
  return keyPart(columns['Parcel Number 1 (Min)'])
    || keyPart(columns['Property Address'])
    || 'record';
}

export function splitFreshAndDuplicates(
  rows: Array<{ columns: Record<string, unknown>; label: string }>,
  existingKeys: Set<string>,
): { fresh: Record<string, unknown>[]; duplicates: string[] } {
  const duplicates: string[] = [];
  const fresh: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (existingKeys.has(recordKey(row.columns))) duplicates.push(row.label);
    else fresh.push(row.columns);
  }
  return { fresh, duplicates };
}
