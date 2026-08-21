import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resultColumns, resultSortValue } from './result-columns.ts';

describe('resultColumns', () => {
  it('lists every core land_sales field, including MSA', () => {
    const keys = resultColumns({ catalogLabels: [] }).map(c => c.key);
    assert.deepEqual(keys, [
      'parcel_id',
      'address',
      'city',
      'county',
      'state',
      'msa',
      'property_type',
      'sale_date',
      'acreage',
      'square_feet',
      'sale_price',
      'price_per_acre',
      'buyer',
    ]);
  });

  it('appends mapped custom fields after core columns, sorted by label', () => {
    const cols = resultColumns({ catalogLabels: ['Zoning', 'Market'] });
    const extras = cols.filter(c => c.kind === 'extra');
    assert.deepEqual(extras.map(c => c.key), ['Market', 'Zoning']);
    assert.equal(cols.at(-2)?.key, 'Market');
    assert.equal(cols.at(-1)?.key, 'Zoning');
  });

  it('includes extras present on records even when the catalog is empty', () => {
    const cols = resultColumns({
      catalogLabels: [],
      records: [{ extras: { Zoning: 'RA' } }, { extras: { Market: 'Raleigh, NC' } }],
    });
    assert.deepEqual(
      cols.filter(c => c.kind === 'extra').map(c => c.key),
      ['Market', 'Zoning'],
    );
  });

  it('unions catalog labels with extras on the current records without duplicates', () => {
    const cols = resultColumns({
      catalogLabels: ['Zoning', 'Submarket'],
      records: [{ extras: { Zoning: 'RA', Market: 'Raleigh, NC' } }],
    });
    assert.deepEqual(
      cols.filter(c => c.kind === 'extra').map(c => c.key),
      ['Market', 'Submarket', 'Zoning'],
    );
  });
});

describe('resultSortValue', () => {
  const row = {
    parcel_id: 'LND-1',
    address: '1012 Poinsettia Ln',
    city: 'Wendell',
    county: 'Wake',
    state: 'NC',
    msa: 'Raleigh',
    property_type: 'Land',
    sale_date: '2026-07-31',
    acreage: 1.5,
    square_feet: 65340,
    sale_price: 485000,
    price_per_acre: 323333.33,
    buyer: 'Acme',
    extras: { Zoning: 'RA' },
  };

  it('reads a core field off the record', () => {
    assert.equal(resultSortValue(row, { kind: 'core', key: 'city', label: 'City' }), 'Wendell');
    assert.equal(resultSortValue(row, { kind: 'core', key: 'acreage', label: 'Acreage' }), 1.5);
  });

  it('reads a custom field from extras', () => {
    assert.equal(
      resultSortValue(row, { kind: 'extra', key: 'Zoning', label: 'Zoning' }),
      'RA',
    );
    assert.equal(
      resultSortValue(row, { kind: 'extra', key: 'Missing', label: 'Missing' }),
      null,
    );
  });
});
