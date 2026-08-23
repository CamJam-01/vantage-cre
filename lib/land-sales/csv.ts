import { parseFlexibleDate } from './dates';
import { landSaleInputSchema, type LandSale, type LandSaleInput } from './schema';

export const csvHeaders = [
  'Parcel ID', 'Address', 'City', 'County', 'State', 'MSA', 'Type',
  'Square Feet', 'Acreage', 'Sale Date', 'Sale Price', 'Buyer',
] as const;

export const csvFields = [
  'parcel_id', 'address', 'city', 'county', 'state', 'msa', 'property_type',
  'square_feet', 'acreage', 'sale_date', 'sale_price', 'buyer',
] as const;

export type CsvField = (typeof csvFields)[number];

export const fieldToHeader: Record<CsvField, string> = {
  parcel_id: 'Parcel ID', address: 'Address', city: 'City', county: 'County', state: 'State',
  msa: 'MSA', property_type: 'Type', square_feet: 'Square Feet', acreage: 'Acreage',
  sale_date: 'Sale Date', sale_price: 'Sale Price', buyer: 'Buyer',
};

export function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function extraKeys(rows: Array<{ extras?: Record<string, string> }>): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.extras ?? {})) keys.add(key);
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

/** Export-side CSV builder — used client-side by the results table's "Export CSV"
 * button (selected rows only) and to generate the import-template download. */
export function makeCsv(rows: LandSale[]): string {
  const extras = extraKeys(rows);
  const header = [...csvHeaders, 'Price / Acre', ...extras].join(',');
  const body = rows.map(row => [
    ...csvFields.map(field => csvCell(row[field] as string | number | null)),
    csvCell(row.price_per_acre),
    ...extras.map(key => csvCell((row.extras ?? {})[key])),
  ].join(','));
  return [header, ...body].join('\r\n');
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
  return [csvHeaders.join(','), csvFields.map(() => '').join(',')].join('\r\n');
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
  return `CSV headers must match the import template exactly: ${csvHeaders.join(', ')}.`;
}

export type ImportRowResult =
  | { row: number; ok: true; data: LandSaleInput; warnings?: string[] }
  | { row: number; ok: false; errors: string[] };

/** Validates template-ordered data rows (one string per csvField) against the
 * schema, producing specific per-row/column error messages (e.g. "Row 4, Sale
 * Price: ..."). Runs identically client-side (instant feedback) and server-side
 * (never trust the client).
 *
 * Sale Date is never a blocking error: if it doesn't parse, the row still
 * imports with sale_date left blank and the original text captured in
 * sale_date_raw, surfaced back as a warning rather than a rejection. */
export function validateDataRows(rows: string[][]): ImportRowResult[] {
  return rows.map((values, index) => {
    const rowNumber = index + 2; // +1 for the header row, +1 to make it 1-indexed
    const [parcelId, address, city, county, state, msa, type, sf, ac, saleDate, salePrice, buyer] = values;
    const dateRecognized = !!saleDate && parseFlexibleDate(saleDate) !== null;
    const parsed = landSaleInputSchema.safeParse({
      parcel_id: parcelId, address, city, county, state, msa: msa || undefined,
      property_type: type, square_feet: sf || undefined, acreage: ac,
      sale_date: saleDate,
      sale_date_raw: dateRecognized ? undefined : (saleDate?.trim() || undefined),
      sale_price: salePrice, buyer,
    });
    if (!parsed.success) {
      const errors = parsed.error.issues.map(issue => {
        const field = String(issue.path[0] ?? '');
        const header = Object.hasOwn(fieldToHeader, field) ? fieldToHeader[field as CsvField] : field;
        return `Row ${rowNumber}, ${header}: ${issue.message}`;
      });
      return { row: rowNumber, ok: false, errors };
    }
    const warnings = parsed.data.sale_date_raw
      ? [`Row ${rowNumber}, Sale Date: "${parsed.data.sale_date_raw}" wasn't recognized as a date — imported without a Sale Date and flagged for review.`]
      : undefined;
    return { row: rowNumber, ok: true, data: parsed.data, warnings };
  });
}

/** Dedupe fingerprint — flags likely-duplicate rows against existing records
 * (reported to the user, never silently skipped). */
export function recordKey(record: Pick<LandSaleInput, 'parcel_id' | 'sale_date' | 'address'>): string {
  return [record.parcel_id, record.sale_date, record.address]
    .map(v => String(v ?? '').trim().toLowerCase())
    .join('|');
}
