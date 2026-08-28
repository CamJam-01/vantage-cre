import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RESULTS_SORT,
  appendSortParams,
  decodeSort,
  encodeSort,
  toggleResultsSort,
} from './results-sort.ts';

describe('decodeSort', () => {
  it('yields Sale Date descending for missing, empty, and every malformed input', () => {
    assert.deepEqual(decodeSort(undefined, undefined), DEFAULT_RESULTS_SORT);
    assert.deepEqual(decodeSort('', 'asc'), DEFAULT_RESULTS_SORT);
    assert.deepEqual(decodeSort('not-a-column', 'asc'), DEFAULT_RESULTS_SORT);
    assert.deepEqual(decodeSort('id', 'asc'), DEFAULT_RESULTS_SORT);
    assert.deepEqual(decodeSort('_sale_date_raw', 'desc'), DEFAULT_RESULTS_SORT);
    assert.deepEqual(decodeSort(4, 'asc'), DEFAULT_RESULTS_SORT);
  });

  it('accepts a catalog header and treats a missing or invalid dir as asc', () => {
    assert.deepEqual(decodeSort('Sale Price', 'asc'), { column: 'Sale Price', dir: 'asc' });
    assert.deepEqual(decodeSort('Sale Price', 'desc'), { column: 'Sale Price', dir: 'desc' });
    assert.deepEqual(decodeSort('Sale Price', undefined), { column: 'Sale Price', dir: 'asc' });
    assert.deepEqual(decodeSort('Sale Price', 'up'), { column: 'Sale Price', dir: 'asc' });
    assert.deepEqual(decodeSort(['Price Per AC Land', 'ignored'], ['desc']), {
      column: 'Price Per AC Land',
      dir: 'desc',
    });
  });
});

describe('encodeSort / round trip', () => {
  it('omits the default newest-first Sale Date sort from the URL', () => {
    assert.equal(encodeSort(DEFAULT_RESULTS_SORT), null);
    assert.equal(encodeSort({ column: 'Sale Date', dir: 'desc' }), null);
    assert.deepEqual(encodeSort({ column: 'Sale Date', dir: 'asc' }), {
      column: 'Sale Date',
      dir: 'asc',
    });
    assert.deepEqual(encodeSort({ column: 'Sale Price', dir: 'desc' }), {
      column: 'Sale Price',
      dir: 'desc',
    });
  });

  it('round-trips a catalog column and drops unknown columns', () => {
    const encoded = encodeSort({ column: 'Zoning', dir: 'asc' });
    assert.ok(encoded);
    assert.deepEqual(decodeSort(encoded.column, encoded.dir), { column: 'Zoning', dir: 'asc' });
    assert.equal(encodeSort({ column: 'not-a-column', dir: 'asc' }), null);
    assert.deepEqual(decodeSort(encodeSort(DEFAULT_RESULTS_SORT)?.column, encodeSort(DEFAULT_RESULTS_SORT)?.dir), DEFAULT_RESULTS_SORT);
  });

  it('writes sort and dir onto an existing query string', () => {
    const params = new URLSearchParams('state=TX');
    appendSortParams(params, { column: 'Sale Price', dir: 'desc' });
    assert.equal(params.get('state'), 'TX');
    assert.equal(params.get('sort'), 'Sale Price');
    assert.equal(params.get('dir'), 'desc');

    const defaultParams = new URLSearchParams('state=TX');
    appendSortParams(defaultParams, DEFAULT_RESULTS_SORT);
    assert.equal(defaultParams.toString(), 'state=TX');
  });
});

describe('toggleResultsSort', () => {
  it('starts a new column ascending and flips the active column', () => {
    assert.deepEqual(toggleResultsSort(DEFAULT_RESULTS_SORT, 'Sale Price'), {
      column: 'Sale Price',
      dir: 'asc',
    });
    assert.deepEqual(toggleResultsSort(DEFAULT_RESULTS_SORT, 'Sale Date'), {
      column: 'Sale Date',
      dir: 'asc',
    });
    assert.deepEqual(toggleResultsSort({ column: 'Sale Price', dir: 'asc' }, 'Sale Price'), {
      column: 'Sale Price',
      dir: 'desc',
    });
  });
});
