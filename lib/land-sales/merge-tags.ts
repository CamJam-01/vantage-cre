import { costarColumnNames } from './costar-fields';
import { costarColumnType, type CostarColumnType } from './costar-column-types';
import { formatCatalogValue } from './format';

/** Merge tags are written `{{ comp_id }}` in a .docx template: the field's
 * catalog header lowercased, with every run of non-alphanumeric characters
 * collapsed to a single underscore. The catalog is closed (AGENTS.md §3.1), so
 * the tag set is derived from `COSTAR_HEADER_ROW` and never hand-maintained —
 * a header added there gets a tag with no further work. All 277 distinct
 * headers produce distinct tags; a test asserts it. */
export function mergeTagName(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function mergeTag(header: string): string {
  return `{{ ${mergeTagName(header)} }}`;
}

/** Matches a tag anywhere in a run of document text. Whitespace inside the
 * braces is optional and the name is matched case-insensitively, so a template
 * author typing `{{comp_id}}` still lands on the right field. */
export const MERGE_TAG_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export type MergeTagDescriptor = {
  /** The tag as an author writes it, e.g. `{{ comp_id }}`. */
  tag: string;
  /** The bare name inside the braces, e.g. `comp_id`. */
  name: string;
  /** The catalog header it fills from, e.g. `Comp ID`. A field has no second name. */
  header: string;
  type: CostarColumnType;
};

/** Every tag a template may use, in canonical catalog order. */
export function mergeTagCatalog(): MergeTagDescriptor[] {
  return costarColumnNames().map(header => ({
    tag: mergeTag(header),
    name: mergeTagName(header),
    header,
    type: costarColumnType(header),
  }));
}

/** One field's merged text. Formatting is `formatCatalogValue` — the same
 * function the results table renders cells with, so a merged document reads
 * exactly as the screen the user selected from. The one deliberate difference
 * is the blank: a cell shows an em dash, but a tag whose field is empty must
 * merge as nothing so the surrounding sentence closes up. */
export function mergeValue(header: string, value: unknown): string {
  if (value == null || value === '') return '';
  return formatCatalogValue(header, value);
}

/** Builds the tag-name → merged-text map for one record's catalog columns.
 * Every tag gets an entry, so a field this record left empty blanks its tag
 * rather than falling through to the "unknown tag" path and printing itself. */
export function mergeValuesFromColumns(
  columns: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const header of costarColumnNames()) {
    values[mergeTagName(header)] = mergeValue(header, columns[header]);
  }
  return values;
}
