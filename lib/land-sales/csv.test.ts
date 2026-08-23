import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { csvFields, csvHeaderError, csvHeaders, makeCsv, makeCsvTemplate, validateDataRows } from './csv.ts';

const templateHeaders = [
  'Parcel ID', 'Address', 'City', 'County', 'State', 'MSA', 'Type',
  'Square Feet', 'Acreage', 'Sale Date', 'Sale Price', 'Buyer',
];

describe('csvHeaderError', () => {
  it('accepts the import template headers regardless of case or surrounding space', () => {
    const headers = [
      'parcel id', '  Address', 'CITY', 'County', 'State', 'msa', 'Type',
      'Square Feet', 'Acreage', 'Sale Date', 'Sale Price', 'Buyer',
    ];
    assert.equal(csvHeaderError(headers), undefined);
  });

  it('rejects extra columns instead of turning them into custom fields', () => {
    const error = csvHeaderError([...templateHeaders, 'Zoning']);
    assert.equal(typeof error, 'string');
    assert.match(error as string, /template/i);
    assert.doesNotMatch(error as string, /map|custom field|new field/i);
  });

  it('rejects renamed headers instead of offering a mapping step', () => {
    const headers = [
      'Property Address', 'Property City', 'County', 'State', 'MSA', 'Type',
      'Square Feet', 'Acreage', 'Sale Date', 'Sale Price', 'Buyer', 'Parcel ID',
    ];
    const error = csvHeaderError(headers);
    assert.equal(typeof error, 'string');
    assert.match(error as string, /template/i);
    assert.doesNotMatch(error as string, /map|custom field|new field/i);
  });
});

describe('makeCsvTemplate', () => {
  it('includes a blank data row so the template itself can import', () => {
    const rows = makeCsvTemplate().split('\r\n');
    assert.equal(rows[0], csvHeaders.join(','));
    assert.equal(rows[1], csvFields.map(() => '').join(','));
  });
});

describe('validateDataRows', () => {
  it('accepts a row with every cell blank', () => {
    const results = validateDataRows([templateHeaders.map(() => '')]);
    assert.equal(results[0].ok, true);
    if (results[0].ok) {
      assert.equal(results[0].data.city, '');
      assert.equal(results[0].data.state, '');
      assert.equal(results[0].data.property_type, '');
      assert.equal(results[0].data.acreage, undefined);
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
