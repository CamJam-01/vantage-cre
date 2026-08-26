import type {
  CoreResultField,
  DetailSheet,
  ResultColumn,
} from './result-columns';

export type DatabaseKey = 'sales';
export const SALES_DATABASE_KEY: DatabaseKey = 'sales';
export type HiddenFieldIds = ReadonlySet<string>;

type ExtraResultColumn = Extract<ResultColumn, { kind: 'extra' }>;

export type RecordDisplaySheet = DetailSheet & {
  extraColumns: ExtraResultColumn[];
};

/** Physical Supabase columns that describe the property rather than the sale.
 * All remaining database columns belong to Transaction Details. */
export const PROPERTY_DETAIL_FIELD_KEYS = new Set([
  'Property Address',
  'Property City',
  'Property State',
  'Property Type',
  'Land Area AC',
  'Land Area SF',
  'Secondary Type',
  'Proposed Use',
  'Zoning',
  'Market',
  'Submarket Name',
  'Property County',
  'Property Zip Code',
  'Assessed Improved',
  'Assessed Land',
  'Assessed Value',
  'Assessed Year',
]);

export function fieldVisibilityId(column: ResultColumn): string {
  return `${column.kind}:${column.key}`;
}

export function visibleCoreField(field: CoreResultField, hidden: HiddenFieldIds): boolean {
  return !hidden.has(`core:${field}`);
}

export function visibleExtraField(label: string, hidden: HiddenFieldIds): boolean {
  return !hidden.has(`extra:${label}`);
}

export function filterVisibleColumns(
  columns: ResultColumn[],
  hidden: HiddenFieldIds,
): ResultColumn[] {
  return columns.filter(column => !hidden.has(fieldVisibilityId(column)));
}

export function filterVisibleDetailSheets(
  sheets: DetailSheet[],
  hidden: HiddenFieldIds,
  availableCoreKeys?: ReadonlySet<CoreResultField>,
): DetailSheet[] {
  return sheets.flatMap(sheet => {
    const sections = sheet.sections.flatMap(section => {
      const fields = section.fields.filter(field => {
        if (availableCoreKeys && !availableCoreKeys.has(field.key)) return false;
        return visibleCoreField(field.key, hidden);
      });
      return fields.length ? [{ ...section, fields }] : [];
    });
    return sections.length ? [{ ...sheet, sections }] : [];
  });
}

export function buildRecordDisplaySheets(
  sheets: DetailSheet[],
  columns: ResultColumn[],
  hidden: HiddenFieldIds,
): RecordDisplaySheet[] {
  const availableCoreKeys = new Set(
    columns.flatMap(column => column.kind === 'core' ? [column.key] : []),
  );
  const coreSheets = filterVisibleDetailSheets(sheets, hidden, availableCoreKeys)
    .map(sheet => ({ ...sheet, extraColumns: [] as ExtraResultColumn[] }));
  const extraColumns = filterVisibleColumns(columns, hidden)
    .filter((column): column is ExtraResultColumn => column.kind === 'extra');

  if (!extraColumns.length) return coreSheets;
  if (!coreSheets.length) {
    return [{
      id: 'additional',
      tab: 'Additional Fields',
      title: 'Additional Fields',
      sections: [],
      extraColumns,
    }];
  }

  const lastIndex = coreSheets.length - 1;
  return coreSheets.map((sheet, index) => (
    index === lastIndex ? { ...sheet, extraColumns } : sheet
  ));
}

/** Split visible physical database fields into the record page's two sheets.
 * Hidden fields are removed before grouping, so neither sheet can reveal a
 * field disabled in Database Manager. Empty sheets are omitted. */
export function buildDatabaseRecordDisplaySheets(
  columns: ResultColumn[],
  hidden: HiddenFieldIds,
): RecordDisplaySheet[] {
  const visibleColumns = filterVisibleColumns(columns, hidden)
    .filter((column): column is ExtraResultColumn => column.kind === 'extra');

  const propertyColumns = visibleColumns.filter(column => PROPERTY_DETAIL_FIELD_KEYS.has(column.key));
  const transactionColumns = visibleColumns.filter(column => !PROPERTY_DETAIL_FIELD_KEYS.has(column.key));

  return [
    {
      id: 'property-details',
      tab: 'Property Details',
      title: 'Property Details',
      sections: [],
      extraColumns: propertyColumns,
    },
    {
      id: 'transaction-details',
      tab: 'Transaction Details',
      title: 'Transaction Details',
      sections: [],
      extraColumns: transactionColumns,
    },
  ].filter(sheet => sheet.extraColumns.length > 0);
}

export type VisibleFieldValidation =
  | { ok: true; hiddenFieldIds: string[] }
  | { ok: false; message: string };

export function validateVisibleFieldIds(
  visibleFieldIds: string[],
  availableColumns: ResultColumn[],
): VisibleFieldValidation {
  if (!visibleFieldIds.length) {
    return { ok: false, message: 'At least one field must remain visible.' };
  }

  const visible = new Set(visibleFieldIds);
  if (visible.size !== visibleFieldIds.length) {
    return { ok: false, message: 'The field selection contains a duplicate field.' };
  }

  const availableIds = availableColumns.map(fieldVisibilityId);
  const available = new Set(availableIds);
  if (visibleFieldIds.some(id => !available.has(id))) {
    return { ok: false, message: 'The field selection contains an unknown field.' };
  }

  return {
    ok: true,
    hiddenFieldIds: availableIds.filter(id => !visible.has(id)),
  };
}
