import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseKey, FieldDivider, FieldDividerKind } from './field-visibility';

export class DisplaySettingsReadError extends Error {
  constructor(message: string) {
    super(`Could not load field visibility: ${message}`);
    this.name = 'DisplaySettingsReadError';
  }
}

/** The one global display configuration for a database: which fields are
 * hidden, the order Database Manager arranges them in, and the page and group
 * dividers that order carries. An empty `fieldOrder` means no order has been
 * saved, so the catalog order stands. */
export type DisplaySettings = {
  hidden: Set<string>;
  fieldOrder: string[];
  fieldDividers: FieldDivider[];
};

const DIVIDER_KINDS: FieldDividerKind[] = ['page', 'group'];

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
  const { data, error } = await supabase
    .from('result_display_settings')
    .select('hidden_field_keys, field_order, field_dividers')
    .eq('database_key', databaseKey)
    .maybeSingle();

  if (error) throw new DisplaySettingsReadError(error.message);

  const row = data as {
    hidden_field_keys?: string[] | null;
    field_order?: string[] | null;
    field_dividers?: unknown;
  } | null;
  return {
    hidden: new Set(row?.hidden_field_keys ?? []),
    fieldOrder: row?.field_order ?? [],
    fieldDividers: readFieldDividers(row?.field_dividers),
  };
}

export async function loadHiddenFieldIds(
  supabase: SupabaseClient,
  databaseKey: DatabaseKey,
): Promise<Set<string>> {
  const { hidden } = await loadDisplaySettings(supabase, databaseKey);
  return hidden;
}
