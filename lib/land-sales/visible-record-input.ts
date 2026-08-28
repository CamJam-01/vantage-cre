import { costarColumnNames } from './costar-fields';
import type { HiddenFieldIds } from './field-visibility';
import type { LandSale, LandSaleInput } from './schema';

export function mergeVisibleUpdate(
  existing: LandSale,
  submitted: LandSaleInput,
  hidden: HiddenFieldIds,
): LandSaleInput {
  const columns: Record<string, unknown> = { ...existing.columns };
  for (const header of costarColumnNames()) {
    if (hidden.has(header)) continue;
    if (Object.prototype.hasOwnProperty.call(submitted.columns, header)) {
      columns[header] = submitted.columns[header];
    }
  }
  return {
    columns,
    saleDateRaw: hidden.has('Sale Date') ? existing.saleDateRaw : submitted.saleDateRaw,
  };
}

export function sanitizeVisibleCreate(
  submitted: LandSaleInput,
  hidden: HiddenFieldIds,
): LandSaleInput {
  const columns: Record<string, unknown> = {};
  for (const header of costarColumnNames()) {
    if (hidden.has(header)) continue;
    columns[header] = submitted.columns[header] ?? null;
  }
  return {
    columns,
    saleDateRaw: hidden.has('Sale Date') ? undefined : submitted.saleDateRaw,
  };
}
