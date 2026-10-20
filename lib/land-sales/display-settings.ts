import type { SupabaseClient } from '@supabase/supabase-js';
import {
  canonicalizeStoredIds,
  type DatabaseKey,
  type FieldDivider,
  type FieldDividerKind,
} from './field-visibility';

export class DisplaySettingsReadError extends Error {
  constructor(message: string) {
    super(`Could not load field visibility: ${message}`);
    this.name = 'DisplaySettingsReadError';
  }
}

/** Where the non-catalog record photo sits on the create/view/edit screens. */
export type RecordImagePlacement = 'tab' | 'above';

export const DEFAULT_RECORD_IMAGE_PLACEMENT: RecordImagePlacement = 'tab';
export const RECORD_PHOTOS_PAGE_ID = 'record-photos';
export const RECORD_PHOTOS_PAGE_TITLE = 'Photos';

/** The one global display configuration for a database: which fields are
 * hidden, the order Database Manager arranges them in, the page and group
 * dividers that order carries, and where the record photo appears. An empty
 * `fieldOrder` means no order has been saved, so the catalog order stands. */
export type DisplaySettings = {
  hidden: Set<string>;
  fieldOrder: string[];
  fieldDividers: FieldDivider[];
  recordImagePlacement: RecordImagePlacement;
};

const DIVIDER_KINDS: FieldDividerKind[] = ['page', 'group'];

/** Stored text; anything other than an approved value falls back to the
 * default so a hand-edited row cannot blank the record screen. */
export function readRecordImagePlacement(value: unknown): RecordImagePlacement {
  return value === 'above' || value === 'tab' ? value : DEFAULT_RECORD_IMAGE_PLACEMENT;
}

/** Stored as jsonb, so a hand-edited row could hold anything; entries that are
 * not a usable divider are dropped rather than crashing the page. */
function readFieldDividers(value: unknown): FieldDivider[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    if (!entry || typeof entry !== 'object') return [];
    const { id, kind, label } = entry as { id?: unknown; kind?: unknown; label?: unknown };
    if (typeof id !== 'string' || !id) return [];
    if (!DIVIDER_KINDS.includes(kind as FieldDividerKind)) return [];
    return [{
      id,
      kind: kind as FieldDividerKind,
      label: typeof label === 'string' ? label : '',
    }];
  });
}

export async function loadDisplaySettings(
  supabase: SupabaseClient,
  databaseKey: DatabaseKey,
): Promise<DisplaySettings> {
  // Prefer the full row; if the placement column is not migrated yet, fall
  // back so record screens keep loading with the Photos-tab default.
  let { data, error } = await supabase
    .from('result_display_settings')
    .select('hidden_field_keys, field_order, field_dividers, record_image_placement')
    .eq('database_key', databaseKey)
    .maybeSingle();

  if (error && /record_image_placement/i.test(error.message)) {
    ({ data, error } = await supabase
      .from('result_display_settings')
      .select('hidden_field_keys, field_order, field_dividers')
      .eq('database_key', databaseKey)
      .maybeSingle());
  }

  if (error) throw new DisplaySettingsReadError(error.message);

  const row = data as {
    hidden_field_keys?: string[] | null;
    field_order?: string[] | null;
    field_dividers?: unknown;
    record_image_placement?: unknown;
  } | null;
  return {
    hidden: new Set(canonicalizeStoredIds(row?.hidden_field_keys)),
    fieldOrder: canonicalizeStoredIds(row?.field_order),
    fieldDividers: readFieldDividers(row?.field_dividers),
    recordImagePlacement: readRecordImagePlacement(row?.record_image_placement),
  };
}

export async function loadHiddenFieldIds(
  supabase: SupabaseClient,
  databaseKey: DatabaseKey,
): Promise<Set<string>> {
  const { hidden } = await loadDisplaySettings(supabase, databaseKey);
  return hidden;
}
