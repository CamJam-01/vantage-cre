import { costarColumnNames } from './costar-fields';
import { costarColumnType } from './costar-column-types';
import type { LandSale } from './schema';

/** One results-table / arrangement column. `key` and `label` are the catalog
 * header — a field has no second name. */
export type ResultColumn = { key: string; label: string };

const DEFAULT_RESULT_COLUMNS: readonly ResultColumn[] =
  costarColumnNames().map(name => ({ key: name, label: name }));

export function resultColumns(): ResultColumn[] {
  return [...DEFAULT_RESULT_COLUMNS];
}

export function resultSortValue(record: LandSale, column: ResultColumn): string | number | null {
  const value = record.columns[column.key];
  if (value == null || value === '') return null;
  const kind = costarColumnType(column.key);
  switch (kind) {
    case 'number':
      return typeof value === 'number' ? value : Number(value);
    case 'boolean':
      return value ? 1 : 0;
    case 'date':
    case 'text':
      return String(value);
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
