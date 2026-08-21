import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySourceMapping,
  csvFields,
  duplicateTargetLabels,
  makeCsv,
  missingRequiredTargets,
  newFieldLabels,
  suggestSourceMapping,
  unmatchedHeaders,
  validateMappedRows,
  type SourceMapping,
} from './csv.ts';

const costarish = [
  'Property Address',
  'Property City',
  'Sale Date',
  'Sale Price',
  'Zoning',
  'Market',
];

describe('unmatchedHeaders', () => {
  it('returns CSV headers that do not case-insensitively match a canonical field label', () => {
    assert.deepEqual(unmatchedHeaders(costarish), [
      { index: 0, header: 'Property Address' },
      { index: 1, header: 'Property City' },
      { index: 4, header: 'Zoning' },
      { index: 5, header: 'Market' },
    ]);
  });

  it('treats canonical names as matched regardless of case or surrounding space', () => {
    assert.deepEqual(unmatchedHeaders(['  city ', 'COUNTY', 'Extra']), [
      { index: 2, header: 'Extra' },
    ]);
  });
});

describe('suggestSourceMapping', () => {
  it('auto-maps exact canonical names, marks selected extras as new, and skips the rest', () => {
    const mapping = suggestSourceMapping(costarish, new Set([4, 5]));
    assert.deepEqual(mapping, [
      { type: 'skip' },
      { type: 'skip' },
      { type: 'existing', field: 'sale_date' },
      { type: 'existing', field: 'sale_price' },
      { type: 'new' },
      { type: 'new' },
    ]);
  });
});

describe('missingRequiredTargets', () => {
  it('lists canonical required fields that no CSV column maps to', () => {
    const mapping = suggestSourceMapping(costarish, new Set([4]));
    assert.deepEqual(missingRequiredTargets(mapping), [
      'City', 'County', 'State', 'Type', 'Acreage',
    ]);
  });
});

describe('duplicateTargetLabels', () => {
  it('lists existing fields targeted by more than one CSV column', () => {
    const mapping: SourceMapping = [
      { type: 'existing', field: 'address' },
      { type: 'existing', field: 'address' },
      { type: 'skip' },
    ];
    assert.deepEqual(duplicateTargetLabels(mapping), ['Address']);
  });
});

describe('applySourceMapping', () => {
  it('builds canonical rows and extras keyed by CSV header, omitting empty extra cells', () => {
    const mapping: SourceMapping = [
      { type: 'existing', field: 'address' },
      { type: 'existing', field: 'city' },
      { type: 'existing', field: 'sale_date' },
      { type: 'existing', field: 'sale_price' },
      { type: 'new' },
      { type: 'skip' },
    ];
    const { canonical, extras } = applySourceMapping(
      [['1012 Poinsettia Ln', 'Wendell', '7/31/2026', '$485,000', 'RA', 'ignored']],
      costarish,
      mapping,
    );
    const addressIdx = csvFields.indexOf('address');
    const cityIdx = csvFields.indexOf('city');
    assert.equal(canonical[0][addressIdx], '1012 Poinsettia Ln');
    assert.equal(canonical[0][cityIdx], 'Wendell');
    assert.deepEqual(extras, [{ Zoning: 'RA' }]);
  });
});

describe('newFieldLabels', () => {
  it('returns CSV headers assigned to create-new-field', () => {
    const mapping = suggestSourceMapping(costarish, new Set([4, 5]));
    assert.deepEqual(newFieldLabels(costarish, mapping), ['Zoning', 'Market']);
  });
});

describe('validateMappedRows', () => {
  it('attaches extras onto schema-valid rows', () => {
    const headers = [
      'Address', 'City', 'County', 'State', 'Type', 'Acreage', 'Sale Date', 'Sale Price', 'Zoning',
    ];
    const mapping = suggestSourceMapping(headers, new Set([8]));
    const results = validateMappedRows(
      [['1012 Poinsettia Ln', 'Wendell', 'Wake', 'NC', 'Land', '1.5', '7/31/2026', '485000', 'RA']],
      headers,
      mapping,
    );
    assert.equal(results[0].ok, true);
    if (results[0].ok) {
      assert.equal(results[0].data.city, 'Wendell');
      assert.deepEqual(results[0].data.extras, { Zoning: 'RA' });
    }
  });
});

describe('makeCsv', () => {
  it('appends custom extra columns after Price / Acre', () => {
    const row = {
      id: '1',
      parcel_id: '',
      address: '1012 Poinsettia Ln',
      city: 'Wendell',
      county: 'Wake',
      state: 'NC',
      property_type: 'Land',
      square_feet: undefined,
      acreage: 1.5,
      sale_date: '2026-07-31',
      sale_price: 485000,
      buyer: '',
      extras: { Zoning: 'RA', Market: 'Raleigh, NC' },
      price_per_acre: 323333.33,
      created_at: '',
      updated_at: '',
    };
    const csv = makeCsv([row]);
    const header = csv.split('\r\n')[0];
    assert.equal(header.endsWith('Price / Acre,Market,Zoning'), true);
    assert.equal(csv.includes('"Raleigh, NC"'), true);
  });
});
