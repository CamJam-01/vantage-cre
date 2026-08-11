import { z } from 'zod';

/** Best-effort numeric coercion for CSV/form input — strips currency symbols,
 * thousands separators and stray whitespace, then quietly drops the value
 * (becomes undefined, not a validation error) if it still doesn't parse as a
 * number or fails `validate`. CSV imports routinely carry non-numeric or
 * out-of-range cells in numeric-looking columns; those rows should still
 * import with the field left blank rather than being rejected outright. */
function numericField(validate: (n: number) => boolean) {
  return z.preprocess(v => {
    if (v === '' || v == null) return undefined;
    const raw = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
    if (!Number.isFinite(raw) || !validate(raw)) return undefined;
    return raw;
  }, z.number().optional());
}

function isValidIsoDate(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Accepts the ISO format the app writes (YYYY-MM-DD) as well as the M/D/YYYY
 * (or M-D-YYYY) format most spreadsheet exports use, normalizing either to ISO.
 * Returns the original string unchanged if neither shape matches, so the
 * schema's regex still rejects it with a clear message. */
function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const slash = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (isValidIsoDate(iso)) return iso;
  }
  return trimmed;
}

/** Single source of truth for the land-sale record shape: the manual-create form,
 * the CSV row validator, and Supabase insert typing all consume this.
 *
 * Property type and the numeric fields are intentionally permissive: real-world
 * CSV exports carry property-type labels beyond our curated five and numeric
 * cells in all sorts of formats. Rather than block an import, an unrecognized
 * type is stored as free text and an unparseable number is stored as null. */
export const landSaleInputSchema = z.object({
  parcel_id: z.string().trim().default(''),
  address: z.string().trim().default(''),
  city: z.string().trim().min(1, 'City is required'),
  county: z.string().trim().min(1, 'County is required'),
  state: z.string().trim().length(2, 'State must be a 2-letter code').toUpperCase(),
  msa: z.string().trim().optional().transform(v => (v ? v : undefined)),
  property_type: z.string().trim().min(1, 'Type is required'),
  square_feet: numericField(n => n > 0),
  acreage: numericField(n => n > 0),
  sale_date: z.preprocess(
    v => (typeof v === 'string' ? normalizeDate(v) : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sale Date must be a valid date, e.g. 2026-06-12 or 06/12/2026')
  ),
  sale_price: numericField(n => n >= 0),
  buyer: z.string().trim().default(''),
});

export type LandSaleInput = z.infer<typeof landSaleInputSchema>;

export type LandSale = LandSaleInput & {
  id: string;
  price_per_acre: number | null;
  created_at: string;
  updated_at: string;
};
