import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseKey } from './field-visibility';

export class DisplaySettingsReadError extends Error {
  constructor(message: string) {
    super(`Could not load field visibility: ${message}`);
    this.name = 'DisplaySettingsReadError';
  }
}

export async function loadHiddenFieldIds(
  supabase: SupabaseClient,
  databaseKey: DatabaseKey,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('result_display_settings')
    .select('hidden_field_keys')
    .eq('database_key', databaseKey)
    .maybeSingle();

  if (error) throw new DisplaySettingsReadError(error.message);

  const row = data as { hidden_field_keys?: string[] | null } | null;
  return new Set(row?.hidden_field_keys ?? []);
}
