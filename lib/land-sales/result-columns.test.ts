import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { costarColumnNames } from './costar-fields.ts';
import {
  DETAIL_COMPUTED_FIELDS,
  DETAIL_SHEETS,
  detailSheetFields,
  resultColumns,
  resultSortValue,
} from './result-columns.ts';

describe('resultColumns', () => {
  it('lists every unique CoStar land_sales column in header order', () => {
    const keys = resultColumns({ catalogLabels: [] }).map(c => c.key);
    assert.deepEqual(keys, costarColumnNames());
    assert.equal(keys[0], 'Property Address');
    assert.equal(keys.includes('parcel_id'), false);
    assert.equal(keys.includes('address'), false);
    assert.equal(keys.includes('price_per_acre'), false);
  });

  it('does not append a separate custom-field catalog', () => {
    const cols = resultColumns({ catalogLabels: ['Zoning', 'Not A Database Column'] });
    assert.equal(cols.some(c => c.kind === 'core'), false);
    assert.equal(cols.every(c => c.kind === 'extra'), true);
    assert.equal(cols.filter(c => c.key === 'Zoning').length, 1);
    assert.equal(cols.some(c => c.key === 'Not A Database Column'), false);
  });

  it('does not turn extras on records into extra columns', () => {
    const cols = resultColumns({
      catalogLabels: [],
      records: [{ extras: { MadeUp: 'RA' } }],
    });
    assert.equal(cols.some(c => c.key === 'MadeUp'), false);
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
    extras: { Zoning: 'RA', 'Property City': 'Wendell' },
  };

  it('reads a core field off the record', () => {
    assert.equal(resultSortValue(row, { kind: 'core', key: 'city', label: 'City' }), 'Wendell');
    assert.equal(resultSortValue(row, { kind: 'core', key: 'acreage', label: 'Acreage' }), 1.5);
  });

  it('reads a CoStar field from extras', () => {
    assert.equal(
      resultSortValue(row, { kind: 'extra', key: 'Property City', label: 'Property City' }),
      'Wendell',
    );
    assert.equal(
      resultSortValue(row, { kind: 'extra', key: 'Missing', label: 'Missing' }),
      null,
    );
  });
});

describe('record details sheets', () => {
  const sheetFields = DETAIL_SHEETS.flatMap(detailSheetFields);

  it('never repeats a field across sheets — both stay mounted, so a repeat would submit twice', () => {
    const keys = sheetFields.map(f => f.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  it('splits the record into a property sheet and a transaction sheet', () => {
    assert.deepEqual(DETAIL_SHEETS.map(s => s.id), ['description', 'transaction']);
    assert.deepEqual(
      detailSheetFields(DETAIL_SHEETS[1]).map(f => f.key),
      ['sale_date', 'sale_price', 'price_per_acre', 'buyer'],
    );
  });

  it('fills whole rows of the 12-column grid within each section', () => {
    for (const sheet of DETAIL_SHEETS) {
      for (const section of sheet.sections) {
        const span = section.fields.reduce((sum, f) => sum + f.span, 0);
        assert.equal(span % 12, 0, `${sheet.id} / ${section.label ?? 'lead'} spans ${span}`);
      }
    }
  });

  it('marks price per acre read-only, since it is derived server-side', () => {
    assert.deepEqual(DETAIL_COMPUTED_FIELDS, ['price_per_acre']);
  });
});
