import { appFieldNames, fieldLabel, VERIFIED_BY_COLUMN } from './app-fields';
import { costarColumnType, type CostarColumnType } from './costar-column-types';
import { formatCatalogValue } from './format';

/** Tags derive from app labels: Comments replaces the provider name, and
 * Verified By joins the catalog-derived tags without entering the CSV catalog. */
export function mergeTagName(header: string): string {
  return fieldLabel(header).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function mergeTag(header: string): string {
  return `{{ ${mergeTagName(header)} }}`;
}

/** Matches a tag anywhere in a run of document text. Whitespace inside the
 * braces is optional and the name is matched case-insensitively, so a template
 * author typing `{{comp_id}}` still lands on the right field. */
export const MERGE_TAG_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

type MergeTagDescriptorBase = {
  /** The tag as an author writes it, e.g. `{{ comp_id }}`. */
  tag: string;
  /** The bare name inside the braces, e.g. `comp_id`. */
  name: string;
  /** The author-facing value name shown in the template catalog. */
  header: string;
};

export type MergeTagDescriptor = MergeTagDescriptorBase & (
  | {
      source: 'catalog' | 'app';
      column: string;
      type: CostarColumnType;
    }
  | {
      source: 'merge';
      type: 'sequence' | 'image';
    }
);

/** Numbers output sections without pretending the sequence is a stored field
 * or allowing it into the closed CoStar catalog. */
export const COMP_NUMBER_MERGE_TAG: MergeTagDescriptor = {
  tag: '{{ comp_number }}',
  name: 'comp_number',
  header: 'Comp Number',
  source: 'merge',
  type: 'sequence',
};

/** Embeds every photo in `_record_images` into the DOCX. Not a catalog field
 * and never CSV — see README §3A carve-outs. */
export const RECORD_IMAGE_MERGE_TAG: MergeTagDescriptor = {
  tag: '{{ record_image }}',
  name: 'record_image',
  header: 'Record Image',
  source: 'merge',
  type: 'image',
};

/** Every tag a template may use. Merge-only tags come first for discoverability;
 * database-field tags retain canonical catalog order. */
export function mergeTagCatalog(): MergeTagDescriptor[] {
  const catalogTags: MergeTagDescriptor[] = appFieldNames().map(header => ({
    tag: mergeTag(header),
    name: mergeTagName(header),
    header: fieldLabel(header),
    column: header,
    source: header === VERIFIED_BY_COLUMN ? 'app' : 'catalog',
    type: costarColumnType(header),
  }));
  return [COMP_NUMBER_MERGE_TAG, RECORD_IMAGE_MERGE_TAG, ...catalogTags];
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
  for (const header of appFieldNames()) {
    values[mergeTagName(header)] = mergeValue(header, columns[header]);
  }
  return values;
}

/** Adds the output-only, 1-based comp sequence to one record's field values.
 * The number is scoped to a single merge request and is never persisted. */
export function mergeValuesForRecord(
  columns: Readonly<Record<string, unknown>>,
  compNumber: number,
): Record<string, string> {
  return {
    ...mergeValuesFromColumns(columns),
    [COMP_NUMBER_MERGE_TAG.name]: String(compNumber),
  };
}
