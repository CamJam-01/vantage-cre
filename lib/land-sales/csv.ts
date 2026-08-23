import { COSTAR_CORE_HEADER_MAP, COSTAR_HEADERS, COSTAR_TYPED_COLUMNS, costarFields } from './costar-fields';
import { parseFlexibleDate } from './dates';
import { landSaleInputSchema, type LandSale, type LandSaleInput } from './schema';

export const csvHeaders = COSTAR_HEADERS;

const exportHeaders = [
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
  const header = [...exportHeaders, 'Price / Acre', ...extras].join(',');
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
  return [csvHeaders.join(','), csvHeaders.map(() => '').join(',')].join('\r\n');
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

function costarCell(values: string[], header: string): string {
  const index = csvHeaders.indexOf(header);
  return index >= 0 ? (values[index] ?? '') : '';
}

function headerForCore(field: (typeof COSTAR_CORE_HEADER_MAP)[keyof typeof COSTAR_CORE_HEADER_MAP]): string {
  const entry = Object.entries(COSTAR_CORE_HEADER_MAP).find(([, value]) => value === field);
  if (!entry) throw new Error(`No CoStar header mapped to ${field}`);
  return entry[0];
}

function costarTextValues(values: string[]): Record<string, string | null> {
  const typed = new Set<string>(COSTAR_TYPED_COLUMNS);
  const columns: Record<string, string | null> = {};
  costarFields().forEach((field, index) => {
    if (typed.has(field.column)) return;
    const raw = (values[index] ?? '').trim();
    columns[field.column] = raw ? raw : null;
  });
  return columns;
}

/** Merge validated core fields with CoStar text columns for a land_sales insert. */
export function importLandSaleRow(row: Extract<ImportRowResult, { ok: true }>): Record<string, unknown> {
  const { extras: _extras, ...core } = row.data;
  return { ...row.columns, ...core };
}

/** Validates template-ordered CoStar data rows against the schema, producing
 * specific per-row/column error messages (e.g. "Row 4, Sale Price: ...").
 * Runs identically client-side (instant feedback) and server-side (never trust
 * the client).
 *
 * Sale Date is never a blocking error: if it doesn't parse, the row still
 * imports with sale_date left blank and the original text captured in
 * sale_date_raw, surfaced back as a warning rather than a rejection.
 * A Property State that isn't a 2-letter code stays on the CoStar column
 * and leaves the core state field empty. */
export function validateDataRows(rows: string[][]): ImportRowResult[] {
  return rows.map((values, index) => {
    const rowNumber = index + 2; // +1 for the header row, +1 to make it 1-indexed
    const core = {
      parcel_id: costarCell(values, headerForCore('parcel_id')),
      address: costarCell(values, headerForCore('address')),
      city: costarCell(values, headerForCore('city')),
      county: costarCell(values, headerForCore('county')),
      state: costarCell(values, headerForCore('state')).trim(),
      msa: costarCell(values, headerForCore('msa')) || undefined,
      property_type: costarCell(values, headerForCore('property_type')),
      square_feet: costarCell(values, headerForCore('square_feet')) || undefined,
      acreage: costarCell(values, headerForCore('acreage')),
      sale_date: costarCell(values, headerForCore('sale_date')),
      sale_price: costarCell(values, headerForCore('sale_price')),
      buyer: costarCell(values, headerForCore('buyer')),
    };
    const dateRecognized = !!core.sale_date && parseFlexibleDate(core.sale_date) !== null;
    const parsed = landSaleInputSchema.safeParse({
      ...core,
      state: core.state.length === 2 ? core.state : '',
      sale_date_raw: dateRecognized ? undefined : (core.sale_date.trim() || undefined),
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
    return { row: rowNumber, ok: true, data: parsed.data, columns: costarTextValues(values), warnings };
  });
}

/** Dedupe fingerprint — flags likely-duplicate rows against existing records
 * (reported to the user, never silently skipped). */
export function recordKey(record: Pick<LandSaleInput, 'parcel_id' | 'sale_date' | 'address'>): string {
  return [record.parcel_id, record.sale_date, record.address]
    .map(v => String(v ?? '').trim().toLowerCase())
    .join('|');
}
