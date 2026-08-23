import type { HiddenFieldIds } from './field-visibility';
import { landSaleInputSchema, type LandSaleInput } from './schema';

const WRITABLE_CORE_FIELDS = [
  'parcel_id',
  'address',
  'city',
  'county',
  'state',
  'msa',
  'property_type',
  'square_feet',
  'acreage',
  'sale_date',
  'sale_price',
  'buyer',
] as const satisfies ReadonlyArray<Exclude<keyof LandSaleInput, 'extras' | 'sale_date_raw'>>;

export function mergeVisibleUpdate(
  existing: LandSaleInput,
  submitted: LandSaleInput,
  availableExtraLabels: string[],
  hidden: HiddenFieldIds,
): LandSaleInput {
  const merged: LandSaleInput = { ...submitted, extras: { ...existing.extras } };

  for (const field of WRITABLE_CORE_FIELDS) {
    if (!hidden.has(`core:${field}`)) continue;
    Object.assign(merged, { [field]: existing[field] });
  }

  merged.sale_date_raw = hidden.has('core:sale_date')
    ? existing.sale_date_raw
    : submitted.sale_date_raw;

  for (const label of availableExtraLabels) {
    if (hidden.has(`extra:${label}`)) continue;
    const value = submitted.extras[label];
    if (value) merged.extras[label] = value;
    else delete merged.extras[label];
  }

  return merged;
}

export function sanitizeVisibleCreate(
  submitted: LandSaleInput,
  availableExtraLabels: string[],
  hidden: HiddenFieldIds,
): LandSaleInput {
  const defaults = landSaleInputSchema.parse({});
  const sanitized: LandSaleInput = { ...submitted, extras: {} };

  for (const field of WRITABLE_CORE_FIELDS) {
    if (!hidden.has(`core:${field}`)) continue;
    Object.assign(sanitized, { [field]: defaults[field] });
  }

  if (hidden.has('core:sale_date')) sanitized.sale_date_raw = undefined;

  for (const label of availableExtraLabels) {
    if (hidden.has(`extra:${label}`)) continue;
    const value = submitted.extras[label];
    if (value) sanitized.extras[label] = value;
  }

  return sanitized;
}
