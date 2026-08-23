import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COSTAR_HEADERS } from './costar-fields.ts';
import { csvHeaderError, csvHeaders, makeCsv, makeCsvTemplate, validateDataRows } from './csv.ts';

function blankCostarRow(): string[] {
  return COSTAR_HEADERS.map(() => '');
}

function costarRow(values: Record<string, string>): string[] {
  const row = blankCostarRow();
  for (const [header, value] of Object.entries(values)) {
    const index = COSTAR_HEADERS.indexOf(header);
    assert.notEqual(index, -1, `unknown CoStar header: ${header}`);
    row[index] = value;
  }
  return row;
}

describe('csvHeaderError', () => {
  it('accepts the CoStar import template headers regardless of case or surrounding space', () => {
    const headers = [...COSTAR_HEADERS];
    headers[0] = '  property address';
    headers[1] = 'PROPERTY CITY';
    assert.equal(csvHeaderError(headers), undefined);
  });

  it('rejects extra columns instead of turning them into custom fields', () => {
    const error = csvHeaderError([...COSTAR_HEADERS, 'Zoning Extra']);
    assert.equal(typeof error, 'string');
    assert.match(error as string, /template/i);
    assert.doesNotMatch(error as string, /map|custom field|new field/i);
  });

  it('rejects renamed headers instead of offering a mapping step', () => {
    const headers = ['Property Address', 'City', ...COSTAR_HEADERS.slice(2)];
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
    assert.equal(rows[0], COSTAR_HEADERS.join(','));
    assert.equal(rows[1], COSTAR_HEADERS.map(() => '').join(','));
  });
});

describe('validateDataRows', () => {
  it('accepts a row with every cell blank', () => {
    const results = validateDataRows([blankCostarRow()]);
    assert.equal(results[0].ok, true);
    if (results[0].ok) {
      assert.equal(results[0].data.city, '');
      assert.equal(results[0].data.state, '');
      assert.equal(results[0].data.property_type, '');
      assert.equal(results[0].data.acreage, undefined);
      assert.equal(results[0].columns.property_address, null);
    }
  });

  it('copies CoStar cells onto matching snake_case columns and mapped core fields', () => {
    const results = validateDataRows([costarRow({
      'Property Address': '123 Main St',
      'Property City': 'Wendell',
      'Property State': 'NC',
      'Sale Price': '$1,000',
      'Buyer (True) Company': 'Acme LLC',
      'Parcel Number 1 (Min)': 'PIN-1',
    })]);
    assert.equal(results[0].ok, true);
    if (results[0].ok) {
      assert.equal(results[0].data.address, '123 Main St');
      assert.equal(results[0].data.city, 'Wendell');
      assert.equal(results[0].data.state, 'NC');
      assert.equal(results[0].data.sale_price, 1000);
      assert.equal(results[0].data.buyer, 'Acme LLC');
      assert.equal(results[0].data.parcel_id, 'PIN-1');
      assert.equal(results[0].columns.property_address, '123 Main St');
      assert.equal(results[0].columns.buyer_true_company, 'Acme LLC');
      assert.equal('sale_price' in results[0].columns, false);
    }
  });

  it('keeps a non-code Property State on the CoStar column without failing the row', () => {
    const results = validateDataRows([costarRow({ 'Property State': 'North Carolina' })]);
    assert.equal(results[0].ok, true);
    if (results[0].ok) {
      assert.equal(results[0].data.state, '');
      assert.equal(results[0].columns.property_state, 'North Carolina');
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
