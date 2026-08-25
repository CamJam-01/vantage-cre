import { costarColumnType } from './costar-column-types';
import type { ResultColumn } from './result-columns';

export type FieldFilter =
  | { column: string; kind: 'text'; contains: string }
  | { column: string; kind: 'number'; min?: number; max?: number }
  | { column: string; kind: 'date'; from?: string; to?: string }
  | { column: string; kind: 'boolean'; value: boolean };

export type DraftFieldFilter =
  | { column: string; kind: 'text'; contains: string }
  | { column: string; kind: 'number'; min: string; max: string }
  | { column: string; kind: 'date'; from: string; to: string }
  | { column: string; kind: 'boolean'; value: '' | 'true' | 'false' };

export function emptyDraftFilter(column: string): DraftFieldFilter {
  const kind = costarColumnType(column);
  switch (kind) {
    case 'text':
      return { column, kind: 'text', contains: '' };
    case 'number':
      return { column, kind: 'number', min: '', max: '' };
    case 'date':
      return { column, kind: 'date', from: '', to: '' };
    case 'boolean':
      return { column, kind: 'boolean', value: '' };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function encodeFieldFilter(filter: FieldFilter): string {
  switch (filter.kind) {
    case 'text':
      return `${filter.column}|text|${filter.contains}`;
    case 'number':
      return `${filter.column}|number|${filter.min ?? ''}:${filter.max ?? ''}`;
    case 'date':
      return `${filter.column}|date|${filter.from ?? ''}:${filter.to ?? ''}`;
    case 'boolean':
      return `${filter.column}|boolean|${filter.value ? 'true' : 'false'}`;
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}

function parseOptionalNumber(raw: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function decodeFieldFilter(raw: string, knownColumns: ReadonlySet<string>): FieldFilter | null {
  const sep = raw.indexOf('|');
  if (sep < 0) return null;
  const column = raw.slice(0, sep);
  const rest = raw.slice(sep + 1);
  const sep2 = rest.indexOf('|');
  if (sep2 < 0) return null;
  const kind = rest.slice(0, sep2);
  const payload = rest.slice(sep2 + 1);
  if (!knownColumns.has(column)) return null;

  switch (kind) {
    case 'text':
      if (!payload) return null;
      return { column, kind: 'text', contains: payload };
    case 'number': {
      const colon = payload.indexOf(':');
      if (colon < 0) return null;
      const min = parseOptionalNumber(payload.slice(0, colon));
      const max = parseOptionalNumber(payload.slice(colon + 1));
      if (min == null && max == null) return null;
      return { column, kind: 'number', ...(min != null ? { min } : {}), ...(max != null ? { max } : {}) };
    }
    case 'date': {
      const colon = payload.indexOf(':');
      if (colon < 0) return null;
      const from = payload.slice(0, colon);
      const to = payload.slice(colon + 1);
      if (!from && !to) return null;
      return { column, kind: 'date', ...(from ? { from } : {}), ...(to ? { to } : {}) };
    }
    case 'boolean':
      if (payload !== 'true' && payload !== 'false') return null;
      return { column, kind: 'boolean', value: payload === 'true' };
    default:
      return null;
  }
}

export function compactDraftFilters(draft: DraftFieldFilter[]): FieldFilter[] {
  const compacted: FieldFilter[] = [];
  for (const item of draft) {
    switch (item.kind) {
      case 'text': {
        const contains = item.contains.trim();
        if (contains) compacted.push({ column: item.column, kind: 'text', contains });
        break;
      }
      case 'number': {
        const min = parseOptionalNumber(item.min);
        const max = parseOptionalNumber(item.max);
        if (min == null && max == null) break;
        compacted.push({ column: item.column, kind: 'number', ...(min != null ? { min } : {}), ...(max != null ? { max } : {}) });
        break;
      }
      case 'date': {
        if (!item.from && !item.to) break;
        compacted.push({ column: item.column, kind: 'date', ...(item.from ? { from: item.from } : {}), ...(item.to ? { to: item.to } : {}) });
        break;
      }
      case 'boolean': {
        if (item.value !== 'true' && item.value !== 'false') break;
        compacted.push({ column: item.column, kind: 'boolean', value: item.value === 'true' });
        break;
      }
      default: {
        const _exhaustive: never = item;
        return _exhaustive;
      }
    }
  }
  return compacted;
}

export function appliedToDraft(filters: FieldFilter[]): DraftFieldFilter[] {
  return filters.map(filter => {
    switch (filter.kind) {
      case 'text':
        return { column: filter.column, kind: 'text', contains: filter.contains };
      case 'number':
        return {
          column: filter.column,
          kind: 'number',
          min: filter.min != null ? String(filter.min) : '',
          max: filter.max != null ? String(filter.max) : '',
        };
      case 'date':
        return { column: filter.column, kind: 'date', from: filter.from ?? '', to: filter.to ?? '' };
      case 'boolean':
        return { column: filter.column, kind: 'boolean', value: filter.value ? 'true' : 'false' };
      default: {
        const _exhaustive: never = filter;
        return _exhaustive;
      }
    }
  });
}

export function draftsDiffer(draft: DraftFieldFilter[], applied: FieldFilter[]): boolean {
  return JSON.stringify(draft) !== JSON.stringify(appliedToDraft(applied));
}

export function addFilterCandidates(
  visibleColumns: ResultColumn[],
  draftedColumns: string[],
  query: string,
): ResultColumn[] {
  const drafted = new Set(draftedColumns);
  const needle = query.trim().toLowerCase();
  return visibleColumns.filter(column => {
    if (drafted.has(column.key)) return false;
    if (!needle) return true;
    return column.label.toLowerCase().includes(needle);
  });
}
