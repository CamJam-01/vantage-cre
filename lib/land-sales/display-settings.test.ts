import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DisplaySettingsReadError,
  loadDisplaySettings,
  loadHiddenFieldIds,
} from './display-settings.ts';

type QueryResult = {
  data: {
    hidden_field_keys: string[] | null;
    field_order?: string[] | null;
    field_dividers?: unknown;
  } | null;
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
    assert.deepEqual([...hidden], ['Zoning']);
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

describe('loadDisplaySettings', () => {
  it('returns an empty arrangement when no settings row exists', async () => {
    assert.deepEqual(
      await loadDisplaySettings(fakeClient({ data: null, error: null }), 'sales'),
      { hidden: new Set(), fieldOrder: [], fieldDividers: [] },
    );
  });

  it('returns the saved arrangement alongside the hidden identifiers', async () => {
    const settings = await loadDisplaySettings(
      fakeClient({
        data: {
          hidden_field_keys: ['extra:Zoning'],
          field_order: ['extra:Market', 'extra:Zoning'],
        },
        error: null,
      }),
      'sales',
    );
    assert.deepEqual([...settings.hidden], ['Zoning']);
    assert.deepEqual(settings.fieldOrder, ['Market', 'Zoning']);
  });

  it('treats a null arrangement as no saved order', async () => {
    const settings = await loadDisplaySettings(
      fakeClient({ data: { hidden_field_keys: null, field_order: null }, error: null }),
      'sales',
    );
    assert.deepEqual(settings.fieldOrder, []);
  });
});

describe('loadDisplaySettings dividers', () => {
  it('returns the saved page and group dividers', async () => {
    const settings = await loadDisplaySettings(
      fakeClient({
        data: {
          hidden_field_keys: [],
          field_dividers: [
            { id: 'txn', kind: 'page', label: 'Transaction' },
            { id: 'site', kind: 'group', label: 'Site' },
          ],
        },
        error: null,
      }),
      'sales',
    );
    assert.deepEqual(settings.fieldDividers, [
      { id: 'txn', kind: 'page', label: 'Transaction' },
      { id: 'site', kind: 'group', label: 'Site' },
    ]);
  });

  it('drops jsonb entries that are not a usable divider', async () => {
    const settings = await loadDisplaySettings(
      fakeClient({
        data: {
          hidden_field_keys: [],
          field_dividers: ['nope', null, { kind: 'group', label: 'No id' }, { id: 'x', kind: 'sheet' }, { id: 'site', kind: 'group' }],
        },
        error: null,
      }),
      'sales',
    );
    assert.deepEqual(settings.fieldDividers, [{ id: 'site', kind: 'group', label: '' }]);
  });

  it('treats a non-array arrangement as no dividers', async () => {
    const settings = await loadDisplaySettings(
      fakeClient({ data: { hidden_field_keys: [], field_dividers: null }, error: null }),
      'sales',
    );
    assert.deepEqual(settings.fieldDividers, []);
  });
});
