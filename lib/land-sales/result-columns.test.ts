import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { costarColumnNames } from './costar-fields.ts';
import { resultColumns, resultSortValue } from './result-columns.ts';
import type { LandSale } from './schema.ts';

describe('resultColumns', () => {
  it('lists every unique CoStar land_sales column in header order', () => {
    const keys = resultColumns().map(c => c.key);
    assert.deepEqual(keys, costarColumnNames());
    assert.equal(keys[0], 'Property Address');
    assert.equal(keys.includes('parcel_id'), false);
    assert.equal(keys.includes('address'), false);
    assert.equal(keys.includes('price_per_acre'), false);
  });

  it('labels every column with its catalog header — no display synonym', () => {
    const market = resultColumns().find(c => c.key === 'Market');
    assert.equal(market?.label, 'Market');
    assert.equal(resultColumns().every(c => c.key === c.label), true);
  });
});

describe('resultSortValue', () => {
  const row: LandSale = {
    id: '1',
    columns: {
      'Property City': 'Wendell',
      'Land Area AC': 1.5,
      Zoning: 'RA',
    },
  };

  it('reads a catalog field off the record columns', () => {
    assert.equal(resultSortValue(row, { key: 'Property City', label: 'Property City' }), 'Wendell');
    assert.equal(resultSortValue(row, { key: 'Land Area AC', label: 'Land Area AC' }), 1.5);
    assert.equal(resultSortValue(row, { key: 'Zoning', label: 'Zoning' }), 'RA');
    assert.equal(resultSortValue(row, { key: 'Missing', label: 'Missing' }), null);
  });
});
