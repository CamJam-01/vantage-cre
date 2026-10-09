import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { COSTAR_HEADERS } from './costar-fields.ts';
import { makeCsv, parseCsv, importLandSaleRow, validateDataRows } from './csv.ts';
import { emptyFilters } from './search-params.ts';
import {
  applyLandSaleFilters,
  fetchLandSalesByIds,
  getDistinctCatalogValues,
  getDistinctProposedUses,
  getDistinctSecondaryTypes,
  loadSearchSuggestions,
  isUnsatisfiableRangeError,
  landSaleFilterClauses,
} from './query.ts';

describe('isUnsatisfiableRangeError', () => {
  it('recognizes PostgREST 416 copy and ignores other failures', () => {
    assert.equal(isUnsatisfiableRangeError({ message: 'Requested range not satisfiable' }), true);
    assert.equal(isUnsatisfiableRangeError({ message: 'JWT expired' }), false);
    assert.equal(isUnsatisfiableRangeError(null), false);
  });
});

describe('applyLandSaleFilters', () => {
  it('combines land and building bounds using their stored units', () => {
    assert.deepEqual(landSaleFilterClauses({
      ...emptyFilters, sfMin: 1000, acMax: 3,
      buildingSfMin: 20000, buildingSfMax: 40000,
    }), [
      { op: 'gte', column: 'Land Area SF', value: 1000 },
      { op: 'lte', column: 'Land Area AC', value: 3 },
      { op: 'gte', column: 'Building SF', value: 20000 },
      { op: 'lte', column: 'Building SF', value: 40000 },
    ]);
    assert.deepEqual(landSaleFilterClauses({
      ...emptyFilters, buildingSfMin: 0, buildingSfMax: 50000,
    }), [
      { op: 'gte', column: 'Building SF', value: 0 },
      { op: 'lte', column: 'Building SF', value: 50000 },
    ]);
  });

  function captureOrders() {
    const orders: Array<{ column: string; ascending: boolean; nullsFirst?: boolean }> = [];
    const builder = {
      select() { return builder; },
      order(column: string, options: { ascending: boolean; nullsFirst?: boolean }) {
        orders.push({ column, ascending: options.ascending, nullsFirst: options.nullsFirst });
        return builder;
      },
      range() { return builder; },
    };
    const supabase = {
      from(table: string) {
        assert.equal(table, 'land_sales');
        return builder;
      },
    } as unknown as SupabaseClient;
    return { orders, supabase };
  }

  it('uses id as a deterministic tie-breaker after descending Sale Date', () => {
    const { orders, supabase } = captureOrders();
    applyLandSaleFilters(supabase, emptyFilters, { from: 0, to: 49 });
    assert.deepEqual(orders, [
      { column: 'Sale Date', ascending: false, nullsFirst: false },
      { column: 'id', ascending: true, nullsFirst: undefined },
    ]);
  });

  it('orders the filtered set by the requested catalog column before paging', () => {
    const { orders, supabase } = captureOrders();
    applyLandSaleFilters(
      supabase,
      emptyFilters,
      { from: 0, to: 49 },
      { column: 'Sale Price', dir: 'desc' },
    );
    assert.deepEqual(orders, [
      { column: 'Sale Price', ascending: false, nullsFirst: false },
      { column: 'id', ascending: true, nullsFirst: undefined },
    ]);
  });

  it('overlaps proposed_use_labels when proposed uses are selected', () => {
    const overlaps: Array<{ column: string; value: string[] }> = [];
    const builder = {
      select() { return builder; },
      order() { return builder; },
      range() { return builder; },
      overlaps(column: string, value: string[]) {
        overlaps.push({ column, value });
        return builder;
      },
    };
    const supabase = {
      from(table: string) {
        assert.equal(table, 'land_sales');
        return builder;
      },
    } as unknown as SupabaseClient;
    applyLandSaleFilters(
      supabase,
      { ...emptyFilters, proposedUses: ['Retail', 'Office'] },
      { from: 0, to: 49 },
    );
    assert.deepEqual(overlaps, [{ column: 'proposed_use_labels', value: ['Retail', 'Office'] }]);
    assert.deepEqual(
      landSaleFilterClauses({ ...emptyFilters, proposedUses: ['Retail'] }),
      [{ op: 'overlaps', column: 'proposed_use_labels', value: ['Retail'] }],
    );
  });

  it('queries improved_sales when that table is requested', () => {
    const tables: string[] = [];
    const builder = {
      select() { return builder; },
      order() { return builder; },
      range() { return builder; },
    };
    const supabase = {
      from(table: string) {
        tables.push(table);
        return builder;
      },
    } as unknown as SupabaseClient;
    applyLandSaleFilters(supabase, emptyFilters, { from: 0, to: 49 }, undefined, 'improved_sales');
    assert.deepEqual(tables, ['improved_sales']);
  });
});

describe('getDistinctSecondaryTypes', () => {
  it('normalizes, deduplicates, and sorts the RPC values', async () => {
    const supabase = {
      rpc: async () => ({ data: [' Retail ', 'Industrial', '', 'Retail'], error: null }),
    } as unknown as SupabaseClient;
    assert.deepEqual(await getDistinctSecondaryTypes(supabase), ['Industrial', 'Retail']);
  });

  it('surfaces RPC failures instead of misreporting an empty type catalog', async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: 'function is unavailable' } }),
    } as unknown as SupabaseClient;
    await assert.rejects(() => getDistinctSecondaryTypes(supabase), /function is unavailable/);
  });

  it('passes the Improved table name to the parameterized RPC', async () => {
    const supabase = {
      rpc: async (fn: string, args?: { p_table: string }) => {
        assert.equal(fn, 'distinct_secondary_types');
        assert.deepEqual(args, { p_table: 'improved_sales' });
        return { data: ['Retail'], error: null };
      },
    } as unknown as SupabaseClient;
    assert.deepEqual(await getDistinctSecondaryTypes(supabase, 'improved_sales'), ['Retail']);
  });

  it('rejects a malformed successful response', async () => {
    const supabase = {
      rpc: async () => ({ data: { value: 'Retail' }, error: null }),
    } as unknown as SupabaseClient;
    await assert.rejects(() => getDistinctSecondaryTypes(supabase), /invalid response/);
  });
});

describe('getDistinctProposedUses', () => {
  it('splits combined RPC values, deduplicates, and sorts', async () => {
    const supabase = {
      rpc: async (fn: string, args?: { p_table: string }) => {
        assert.equal(fn, 'distinct_proposed_uses');
        assert.equal(args, undefined);
        return { data: [' Retail, Office ', 'Industrial', '', 'Retail'], error: null };
      },
    } as unknown as SupabaseClient;
    assert.deepEqual(await getDistinctProposedUses(supabase), ['Industrial', 'Office', 'Retail']);
  });

  it('surfaces RPC failures instead of misreporting an empty catalog', async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: 'function is unavailable' } }),
    } as unknown as SupabaseClient;
    await assert.rejects(() => getDistinctProposedUses(supabase), /function is unavailable/);
  });

  it('rejects a malformed successful response', async () => {
    const supabase = {
      rpc: async () => ({ data: { value: 'Retail' }, error: null }),
    } as unknown as SupabaseClient;
    await assert.rejects(() => getDistinctProposedUses(supabase), /invalid response/);
  });
});

describe('getDistinctCatalogValues', () => {
  it('normalizes, deduplicates, and sorts RPC values', async () => {
    const supabase = {
      rpc: async (fn: string, args?: { p_table: string; p_column: string }) => {
        assert.equal(fn, 'distinct_catalog_values');
        assert.deepEqual(args, { p_table: 'land_sales', p_column: 'Market' });
        return { data: [' Raleigh ', 'Charlotte', '', 'Raleigh'], error: null };
      },
    } as unknown as SupabaseClient;
    assert.deepEqual(await getDistinctCatalogValues(supabase, 'Market'), ['Charlotte', 'Raleigh']);
  });

  it('rejects columns outside the whitelist', async () => {
    const supabase = { rpc: async () => ({ data: [], error: null }) } as unknown as SupabaseClient;
    await assert.rejects(
      () => getDistinctCatalogValues(supabase, 'Property Name'),
      /does not allow column/,
    );
  });

  it('falls back to a capped select when the RPC is missing', async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: 'Could not find the function' } }),
      from() {
        return {
          select() {
            return {
              not() {
                return {
                  limit: async () => ({
                    data: [{ Market: ' Raleigh ' }, { Market: 'Charlotte' }, { Market: 'Raleigh' }],
                    error: null,
                  }),
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;
    assert.deepEqual(await getDistinctCatalogValues(supabase, 'Market'), ['Charlotte', 'Raleigh']);
  });
});

describe('loadSearchSuggestions', () => {
  it('routes Proposed Use and Secondary Type to their split RPCs', async () => {
    const calls: Array<{ fn: string; args?: Record<string, string> }> = [];
    const supabase = {
      rpc: async (fn: string, args?: Record<string, string>) => {
        calls.push({ fn, args });
        if (fn === 'distinct_proposed_uses') return { data: ['Retail, Office'], error: null };
        if (fn === 'distinct_secondary_types') return { data: ['Industrial'], error: null };
        return { data: ['Sample'], error: null };
      },
    } as unknown as SupabaseClient;
    const suggestions = await loadSearchSuggestions(supabase);
    assert.deepEqual(suggestions['Proposed Use'], ['Office', 'Retail']);
    assert.deepEqual(suggestions['Secondary Type'], ['Industrial']);
    assert.equal(calls.some(call => call.fn === 'distinct_proposed_uses'), true);
    assert.equal(calls.some(call => call.fn === 'distinct_secondary_types'), true);
    assert.equal(calls.some(call => call.fn === 'distinct_catalog_values'), true);
  });

  it('keeps empty lists when a column RPC fails', async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: 'function is unavailable' } }),
    } as unknown as SupabaseClient;
    const suggestions = await loadSearchSuggestions(supabase);
    assert.deepEqual(suggestions['Property City'], []);
    assert.deepEqual(suggestions['Sale Status'], []);
  });
});

describe('fetchLandSalesByIds', () => {
  it('chunks full-row reads, restores selection order, and preserves hidden fields through CSV re-import', async () => {
    const ids = Array.from({ length: 101 }, (_, index) =>
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    );
    const requestedChunks: string[][] = [];
    const rows = new Map(ids.map((id, index) => [id, {
      id,
      'Property Address': `${index + 1} Export Way`,
      'Sale Date': '2026-08-27',
      Zoning: index === 0 ? 'HIDDEN-RA' : 'RA',
      _sale_date_raw: null,
    }]));
    const supabase = {
      from(table: string) {
        assert.equal(table, 'land_sales');
        return {
          select(columns: string) {
            assert.equal(columns, '*');
            return {
              async in(column: string, chunk: string[]) {
                assert.equal(column, 'id');
                requestedChunks.push([...chunk]);
                return {
                  data: chunk.map(id => rows.get(id)).filter(Boolean).reverse(),
                  error: null,
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const fetched = await fetchLandSalesByIds(supabase, ids);
    assert.equal(fetched.error, null);
    assert.deepEqual(requestedChunks.map(chunk => chunk.length), [100, 1]);
    assert.deepEqual(fetched.records.map(record => record.id), ids);

    const csv = makeCsv(fetched.records);
    const parsed = parseCsv(csv);
    assert.equal(parsed[0].length, COSTAR_HEADERS.length);
    const validated = validateDataRows(parsed.slice(1));
    assert.equal(validated.length, ids.length);
    assert.equal(validated[0].ok, true);
    if (!validated[0].ok) return;
    const reimported = importLandSaleRow(validated[0]);
    assert.equal(reimported.Zoning, 'HIDDEN-RA');
    assert.equal(reimported['Property Address'], '1 Export Way');
  });
});
