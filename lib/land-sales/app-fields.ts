import { costarColumnNames, costarHeaders } from './costar-fields';
import type { SalesPathId } from './sales-path';

export const COMMENTS_COLUMN = 'Transaction Notes';
export const VERIFIED_BY_COLUMN = '_verified_by';

/** These approved presentation exceptions never change the provider's CSV headers. */
export function fieldLabel(column: string): string {
  if (column === COMMENTS_COLUMN) return 'Comments';
  if (column === VERIFIED_BY_COLUMN) return 'Verified By';
  return column;
}

/** The app reuses the catalog controls, with one stored text field outside CSV. */
export function appFieldNames(pathId: SalesPathId = 'land'): string[] {
  return costarColumnNames(costarHeaders(pathId)).flatMap(column =>
    column === COMMENTS_COLUMN ? [column, VERIFIED_BY_COLUMN] : [column],
  );
}

/** Seed existing arrangements once; an explicit Admin placement always wins. */
export function withDefaultVerifiedByOrder(order: readonly string[]): string[] {
  if (order.includes(VERIFIED_BY_COLUMN)) return [...order];
  return order.flatMap(column =>
    column === COMMENTS_COLUMN ? [column, VERIFIED_BY_COLUMN] : [column],
  );
}
