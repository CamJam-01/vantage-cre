import type { ResultColumn } from '../land-sales/result-columns';
import {
  SALES_DATABASE_KEY,
  validateVisibleFieldIds,
  type DatabaseKey,
} from '../land-sales/field-visibility';

export type VisibilitySubmission =
  | { ok: true; databaseKey: DatabaseKey; hiddenFieldIds: string[] }
  | { ok: false; message: string };

export function parseVisibilitySubmission(
  formData: FormData,
  availableColumns: ResultColumn[],
): VisibilitySubmission {
  if (formData.get('database_key') !== SALES_DATABASE_KEY) {
    return {
      ok: false,
      message: 'This database is not available for field visibility settings.',
    };
  }

  const visibleFieldIds = formData.getAll('visible_field_id')
    .filter((value): value is string => typeof value === 'string');
  const validation = validateVisibleFieldIds(visibleFieldIds, availableColumns);
  if (!validation.ok) return validation;

  return {
    ok: true,
    databaseKey: SALES_DATABASE_KEY,
    hiddenFieldIds: validation.hiddenFieldIds,
  };
}
