import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { appFieldNames } from './app-fields.ts';
import { resultColumns, resultSortValue } from './result-columns.ts';
import type { LandSale } from './schema.ts';

describe('resultColumns', () => {
  it('lists all app fields in default order', () => {
    const keys = resultColumns().map(c => c.key);
    assert.deepEqual(keys, appFieldNames());
    assert.equal(keys[0], 'Property Address');
    assert.equal(keys.includes('parcel_id'), false);
    assert.equal(keys.includes('address'), false);
    assert.equal(keys.includes('price_per_acre'), false);
  });

  it('uses Comments and Verified By as the only display exceptions', () => {
    const market = resultColumns().find(c => c.key === 'Market');
    assert.equal(market?.label, 'Market');
    assert.deepEqual(resultColumns().filter(c => c.key !== c.label), [
      { key: 'Transaction Notes', label: 'Comments' },
      { key: '_verified_by', label: 'Verified By' },
    ]);
  });

  it('preserves the parameterized API without letting records redefine the closed catalog', () => {
    const columns = resultColumns({
      catalogLabels: ['Prototype Label'],
      records: [{ id: '1', columns: { prototype_field: 'ignored' } }],
    });
    assert.deepEqual(columns.map(column => column.key), appFieldNames());
    assert.equal(columns.some(column => column.key === 'prototype_field'), false);
    assert.notEqual(columns, resultColumns());
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
