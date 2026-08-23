import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DisplaySettingsReadError,
  loadHiddenFieldIds,
} from './display-settings.ts';

type QueryResult = {
  data: { hidden_field_keys: string[] | null } | null;
  error: { message: string } | null;
};

function fakeClient(result: QueryResult): SupabaseClient {
  const query = {
    select() { return query; },
    eq() { return query; },
    async maybeSingle() { return result; },
  };
  return { from: () => query } as unknown as SupabaseClient;
}

describe('loadHiddenFieldIds', () => {
  it('returns an empty set when no settings row exists', async () => {
    const hidden = await loadHiddenFieldIds(
      fakeClient({ data: null, error: null }),
      'sales',
    );
    assert.deepEqual([...hidden], []);
  });

  it('returns the saved hidden identifiers', async () => {
    const hidden = await loadHiddenFieldIds(
      fakeClient({ data: { hidden_field_keys: ['core:address', 'extra:Zoning'] }, error: null }),
      'sales',
    );
    assert.deepEqual([...hidden], ['core:address', 'extra:Zoning']);
  });

  it('treats a null key array as an empty set', async () => {
    const hidden = await loadHiddenFieldIds(
      fakeClient({ data: { hidden_field_keys: null }, error: null }),
      'sales',
    );
    assert.deepEqual([...hidden], []);
  });

  it('throws a typed error instead of failing open', async () => {
    await assert.rejects(
      loadHiddenFieldIds(
        fakeClient({ data: null, error: { message: 'permission denied' } }),
        'sales',
      ),
      (error: unknown) => (
        error instanceof DisplaySettingsReadError
        && error.message === 'Could not load field visibility: permission denied'
      ),
    );
  });
});
