import type { SalesPathId } from './sales-path';
import { appFieldNames, fieldLabel } from './app-fields';
import { costarColumnType } from './costar-column-types';
import type { LandSale } from './schema';

/** Stored keys remain stable while labels follow the approved app vocabulary. */
export type ResultColumn = { key: string; label: string };

export type ResultColumnsOptions = {
  pathId?: SalesPathId;
  [option: string]: unknown;
};

/** Legacy option objects remain accepted for source compatibility. The closed
 * app field sequence for the selected path is authoritative; records cannot redefine it. */
export function resultColumns(options: ResultColumnsOptions = {}): ResultColumn[] {
  return appFieldNames(options.pathId).map(key => ({ key, label: fieldLabel(key) }));
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
