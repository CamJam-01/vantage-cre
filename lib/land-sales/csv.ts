import { landSaleInputSchema, type LandSale, type LandSaleInput } from './schema';

export const csvHeaders = [
  'Parcel ID', 'Address', 'City', 'County', 'State', 'MSA', 'Type',
  'Square Feet', 'Acreage', 'Sale Date', 'Sale Price', 'Buyer',
] as const;

export const csvFields: (keyof LandSale)[] = [
  'parcel_id', 'address', 'city', 'county', 'state', 'msa', 'property_type',
  'square_feet', 'acreage', 'sale_date', 'sale_price', 'buyer',
];

export type CsvField = (typeof csvFields)[number];

/** Fields the schema requires — a mapping is unusable until every one of these
 * is assigned to a source column. */
export const REQUIRED_CSV_FIELDS: CsvField[] = [
  'city', 'county', 'state', 'property_type', 'acreage', 'sale_date', 'sale_price',
];

const fieldToHeader: Record<string, string> = {
  parcel_id: 'Parcel ID', address: 'Address', city: 'City', county: 'County', state: 'State',
  msa: 'MSA', property_type: 'Type', square_feet: 'Square Feet', acreage: 'Acreage',
  sale_date: 'Sale Date', sale_price: 'Sale Price', buyer: 'Buyer',
};

export function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Export-side CSV builder — used client-side by the results table's "Export CSV"
 * button (selected rows only) and to generate the import-template download. */
export function makeCsv(rows: LandSale[]): string {
  const header = [...csvHeaders, 'Price / Acre'].join(',');
  const body = rows.map(row => [
    ...csvFields.map(field => csvCell(row[field] as string | number | null)),
    csvCell(row.price_per_acre),
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

/** Import template: header row only, for users to fill in and re-upload. */
export function makeCsvTemplate(): string {
  return csvHeaders.join(',');
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

/** Maps each target field (parcel_id, address, ...) to the index of the source
 * CSV column that holds it. A field absent from the mapping is left blank on import. */
export type ColumnMapping = Partial<Record<CsvField, number>>;

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

/** Best-effort auto-mapping by case-insensitive header name match. Used both to
 * skip the mapping step entirely when headers already match, and to prefill the
 * mapping form with sensible guesses when they don't. */
export function suggestHeaderMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  csvFields.forEach((field, i) => {
    const label = csvHeaders[i].toLowerCase();
    const idx = headers.findIndex(h => h.trim().toLowerCase() === label);
    if (idx !== -1) mapping[field] = idx;
  });
  return mapping;
}

export function missingRequiredMappings(mapping: ColumnMapping): string[] {
  return REQUIRED_CSV_FIELDS.filter(f => mapping[f] == null).map(f => fieldToHeader[f]);
}

/** Reorders raw data rows into canonical field order per the mapping. A field
 * with no assigned source column comes through as ''. */
export function applyHeaderMapping(dataRows: string[][], mapping: ColumnMapping): string[][] {
  return dataRows.map(row =>
    csvFields.map(field => {
      const idx = mapping[field];
      return idx != null ? (row[idx] ?? '').trim() : '';
    })
  );
}

export type ImportRowResult =
  | { row: number; ok: true; data: LandSaleInput }
  | { row: number; ok: false; errors: string[] };

/** Validates already-mapped data rows (canonical field order, one string per
 * csvField) against the schema, producing specific per-row/column error
 * messages (e.g. "Row 4, Sale Price: ..."). Runs identically client-side
 * (instant feedback) and server-side (never trust the client). */
export function validateDataRows(rows: string[][]): ImportRowResult[] {
  return rows.map((values, index) => {
    const rowNumber = index + 2; // +1 for the header row, +1 to make it 1-indexed
    const [parcelId, address, city, county, state, msa, type, sf, ac, saleDate, salePrice, buyer] = values;
    const parsed = landSaleInputSchema.safeParse({
      parcel_id: parcelId, address, city, county, state, msa: msa || undefined,
      property_type: type, square_feet: sf || undefined, acreage: ac,
      sale_date: saleDate, sale_price: salePrice, buyer,
    });
    if (!parsed.success) {
      const errors = parsed.error.issues.map(issue => {
        const field = String(issue.path[0] ?? '');
        const header = fieldToHeader[field] ?? field;
        return `Row ${rowNumber}, ${header}: ${issue.message}`;
      });
      return { row: rowNumber, ok: false, errors };
    }
    return { row: rowNumber, ok: true, data: parsed.data };
  });
}

/** Dedupe fingerprint — flags likely-duplicate rows against existing records
 * (reported to the user, never silently skipped). */
export function recordKey(record: Pick<LandSaleInput, 'parcel_id' | 'sale_date' | 'address'>): string {
  return [record.parcel_id, record.sale_date, record.address]
    .map(v => String(v ?? '').trim().toLowerCase())
    .join('|');
}
