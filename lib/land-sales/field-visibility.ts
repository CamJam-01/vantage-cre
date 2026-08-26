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

/** Admin-defined display order, as field-visibility identifiers. A saved order
 * lists every known field, but a CoStar column added since the last save will
 * be missing from it — those keep their catalog order and follow the rest. */
export type FieldOrder = readonly string[];

/** A break in the arrangement. Dividers hold no data of their own: each sits in
 * `FieldOrder` as a `<kind>:<id>` token and titles what follows it — a `page`
 * starts a new tab on the record screens, a `group` a section within one. */
export type FieldDividerKind = 'page' | 'group';
export type FieldDivider = { id: string; kind: FieldDividerKind; label: string };

export const FIELD_DIVIDER_PREFIXES: Record<FieldDividerKind, string> = {
  page: 'page:',
  group: 'group:',
};
export const DEFAULT_FIELD_DIVIDER_LABELS: Record<FieldDividerKind, string> = {
  page: 'Page',
  group: 'Field Group',
};
export const FIELD_DIVIDER_LABEL_MAX_LENGTH = 60;

export function fieldDividerOrderId(divider: Pick<FieldDivider, 'id' | 'kind'>): string {
  return `${FIELD_DIVIDER_PREFIXES[divider.kind]}${divider.id}`;
}

export function isFieldDividerOrderId(id: string): boolean {
  return Object.values(FIELD_DIVIDER_PREFIXES).some(prefix => id.startsWith(prefix));
}

/** One line of the Database Manager arrangement: a configurable field, or a
 * divider standing between fields. */
export type FieldDisplayRow =
  | { kind: 'divider'; id: string; divider: FieldDivider }
  | { kind: 'column'; id: string; column: ResultColumn };

/** Resolves the saved arrangement against the columns and dividers that still
 * exist. Tokens naming something gone are dropped, and columns the arrangement
 * never mentioned keep their catalog order at the end. */
export function fieldDisplayRows(
  columns: ResultColumn[],
  order: FieldOrder,
  dividers: readonly FieldDivider[] = [],
): FieldDisplayRow[] {
  const columnsById = new Map(columns.map(column => [fieldVisibilityId(column), column]));
  const dividersById = new Map(dividers.map(divider => [fieldDividerOrderId(divider), divider]));
  const placed = new Set<string>();
  const rows: FieldDisplayRow[] = [];

  for (const id of order) {
    if (placed.has(id)) continue;
    const divider = dividersById.get(id);
    if (divider) {
      placed.add(id);
      rows.push({ kind: 'divider', id, divider });
      continue;
    }
    const column = columnsById.get(id);
    if (column) {
      placed.add(id);
      rows.push({ kind: 'column', id, column });
    }
  }

  for (const column of columns) {
    const id = fieldVisibilityId(column);
    if (!placed.has(id)) rows.push({ kind: 'column', id, column });
  }

  return rows;
}

export function orderColumns(columns: ResultColumn[], order: FieldOrder): ResultColumn[] {
  if (!order.length) return columns;
  const rank = new Map(order.map((id, index) => [id, index]));
  return columns
    .map((column, index) => ({ column, index, rank: rank.get(fieldVisibilityId(column)) }))
    .sort((a, b) => {
      if (a.rank === undefined || b.rank === undefined) {
        if (a.rank === b.rank) return a.index - b.index;
        return a.rank === undefined ? 1 : -1;
      }
      return a.rank - b.rank;
    })
    .map(entry => entry.column);
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

/** What a record page lays out, in order: a group heading, or one field. */
export type RecordDisplayItem =
  | { kind: 'group'; id: string; label: string }
  | { kind: 'field'; column: ExtraResultColumn };

/** One tab of the record screens. `title` is null for the lead page — the
 * fields an admin left above the first page divider, which need no tab. */
export type RecordDisplayPage = {
  id: string;
  title: string | null;
  items: RecordDisplayItem[];
};

export const LEAD_RECORD_PAGE_ID = 'record-lead';

/** Lays the arrangement out as the record screens read it. A page divider opens
 * a tab and closes whatever group was open, so a group titles a section within
 * one page only. Hidden fields never reach a page, so a divider whose fields are
 * all hidden titles nothing, and a page left with no fields is dropped. */
export function buildRecordDisplayPages(
  rows: FieldDisplayRow[],
  hidden: HiddenFieldIds,
): RecordDisplayPage[] {
  const pages: RecordDisplayPage[] = [{ id: LEAD_RECORD_PAGE_ID, title: null, items: [] }];
  let current = pages[0];
  let pendingGroup: FieldDivider | null = null;
  let openGroupId: string | null = null;

  for (const row of rows) {
    if (row.kind === 'divider') {
      if (row.divider.kind === 'page') {
        current = { id: row.divider.id, title: row.divider.label, items: [] };
        pages.push(current);
        pendingGroup = null;
        openGroupId = null;
      } else {
        pendingGroup = row.divider;
      }
      continue;
    }

    const column = row.column;
    if (column.kind !== 'extra') continue;
    if (hidden.has(row.id)) continue;

    if (pendingGroup && pendingGroup.id !== openGroupId) {
      current.items.push({ kind: 'group', id: pendingGroup.id, label: pendingGroup.label });
      openGroupId = pendingGroup.id;
    }
    current.items.push({ kind: 'field', column });
  }

  return pages.filter(page => page.items.some(item => item.kind === 'field'));
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

export type FieldOrderValidation =
  | { ok: true; fieldOrder: string[] }
  | { ok: false; message: string };

/** An empty submission means the admin never reordered anything, which saves
 * the catalog order verbatim. Anything else must name known fields and dividers
 * once each; fields it omits are appended so the stored order stays complete. */
export function validateFieldOrder(
  fieldOrder: string[],
  availableColumns: ResultColumn[],
  dividers: readonly FieldDivider[] = [],
): FieldOrderValidation {
  const availableIds = availableColumns.map(fieldVisibilityId);
  if (!fieldOrder.length) return { ok: true, fieldOrder: availableIds };

  const ordered = new Set(fieldOrder);
  if (ordered.size !== fieldOrder.length) {
    return { ok: false, message: 'The field order contains a duplicate field.' };
  }

  const dividerIds = new Set(dividers.map(fieldDividerOrderId));
  if (fieldOrder.some(id => isFieldDividerOrderId(id) && !dividerIds.has(id))) {
    return { ok: false, message: 'The field order contains an unknown page or field group.' };
  }

  const available = new Set(availableIds);
  if (fieldOrder.some(id => !isFieldDividerOrderId(id) && !available.has(id))) {
    return { ok: false, message: 'The field order contains an unknown field.' };
  }

  return {
    ok: true,
    fieldOrder: [...fieldOrder, ...availableIds.filter(id => !ordered.has(id))],
  };
}
