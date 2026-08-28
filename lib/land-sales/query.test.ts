import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { COSTAR_HEADERS } from './costar-fields.ts';
import { makeCsv, parseCsv, importLandSaleRow, validateDataRows } from './csv.ts';
import { emptyFilters } from './search-params.ts';
import {
  applyLandSaleFilters,
  fetchLandSalesByIds,
  getDistinctSecondaryTypes,
  isUnsatisfiableRangeError,
} from './query.ts';

describe('isUnsatisfiableRangeError', () => {
  it('recognizes PostgREST 416 copy and ignores other failures', () => {
    assert.equal(isUnsatisfiableRangeError({ message: 'Requested range not satisfiable' }), true);
    assert.equal(isUnsatisfiableRangeError({ message: 'JWT expired' }), false);
    assert.equal(isUnsatisfiableRangeError(null), false);
  });
});

describe('applyLandSaleFilters', () => {
  it('uses id as a deterministic tie-breaker after descending Sale Date', () => {
    const orders: Array<{ column: string; ascending: boolean }> = [];
    const builder = {
      select() { return builder; },
      order(column: string, options: { ascending: boolean }) {
        orders.push({ column, ascending: options.ascending });
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

    applyLandSaleFilters(supabase, emptyFilters, { from: 0, to: 49 });
    assert.deepEqual(orders, [
      { column: 'Sale Date', ascending: false },
      { column: 'id', ascending: true },
    ]);
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

  it('rejects a malformed successful response', async () => {
    const supabase = {
      rpc: async () => ({ data: { value: 'Retail' }, error: null }),
    } as unknown as SupabaseClient;
    await assert.rejects(() => getDistinctSecondaryTypes(supabase), /invalid response/);
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
