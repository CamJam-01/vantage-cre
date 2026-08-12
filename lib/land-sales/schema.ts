import { z } from 'zod';
import { parseFlexibleDate } from './dates';

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

/** Single source of truth for the land-sale record shape: the manual-create form,
 * the CSV row validator, and Supabase insert typing all consume this.
 *
 * Property type, the numeric fields, and the sale date are intentionally
 * permissive: real-world CSV exports carry property-type labels beyond our
 * curated five, numeric cells in all sorts of formats, and dates in shapes
 * `parseFlexibleDate` doesn't recognize. Rather than block an import, an
 * unrecognized type is stored as free text, an unparseable number is stored
 * as null, and an unparseable date is stored as null with the original text
 * preserved in `sale_date_raw` for the UI to flag. */
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
  /** Never blocks import: an unparseable date just comes through as undefined
   * (stored null) — `sale_date_raw` below is where the CSV row builder stashes
   * the original text in that case, so the UI can flag the record for review
   * instead of losing the source data or rejecting the row. */
  sale_date: z.preprocess(
    v => (typeof v === 'string' ? (parseFlexibleDate(v) ?? undefined) : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  ),
  sale_date_raw: z.string().trim().optional().transform(v => (v ? v : undefined)),
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
