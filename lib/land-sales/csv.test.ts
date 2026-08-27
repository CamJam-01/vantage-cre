import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COSTAR_HEADER_ROW, COSTAR_HEADERS } from './costar-fields.ts';
import { csvHeaderError, csvHeaders, importLandSaleRow, makeCsv, makeCsvTemplate, parseCsv, validateDataRows } from './csv.ts';

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
    assert.equal(rows[0], COSTAR_HEADER_ROW);
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
      assert.equal(results[0].columns['Property Address'], null);
    }
  });

  it('copies CoStar cells onto exact header columns and mapped core fields', () => {
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
      assert.equal(results[0].columns['Property Address'], '123 Main St');
      assert.equal(results[0].columns['Buyer (True) Company'], 'Acme LLC');
      assert.equal(results[0].columns['Sale Price'], '$1,000');
    }
  });

  it('imports onto CoStar columns without the old parcel_id/address fields', () => {
    const results = validateDataRows([costarRow({
      'Property Address': '123 Main St',
      'Property State': 'North Carolina',
      'Sale Price': '$1,000',
      'Land Area AC': '2.5',
    })]);
    assert.equal(results[0].ok, true);
    if (!results[0].ok) return;
    const inserted = importLandSaleRow(results[0]);
    assert.equal('parcel_id' in inserted, false);
    assert.equal('address' in inserted, false);
    assert.equal(inserted['Property Address'], '123 Main St');
    assert.equal(inserted['Property State'], 'North Carolina');
    assert.equal(inserted['Sale Price'], 1000);
    assert.equal(inserted['Land Area AC'], 2.5);
  });

  it('keeps a non-code Property State on the CoStar column without failing the row', () => {
    const results = validateDataRows([costarRow({ 'Property State': 'North Carolina' })]);
    assert.equal(results[0].ok, true);
    if (results[0].ok) {
      assert.equal(results[0].data.state, '');
      assert.equal(results[0].columns['Property State'], 'North Carolina');
    }
  });

  it('accepts Sale Date values with a trailing Excel/CoStar timestamp', () => {
    const results = validateDataRows([costarRow({ 'Sale Date': '8/13/2026 0:00' })]);
    assert.equal(results[0].ok, true);
    if (results[0].ok) {
      assert.equal(results[0].data.sale_date, '2026-08-13');
      assert.equal(results[0].data.sale_date_raw, undefined);
      assert.equal(results[0].warnings, undefined);
    }
  });
});

describe('makeCsv', () => {
  it('writes the exact CoStar template header row', () => {
    const header = makeCsv([]).split('\r\n')[0];
    assert.equal(header, COSTAR_HEADER_ROW);
    assert.equal(csvHeaderError(header.split(',')), undefined);
  });

  it('uses the CoStar template headers in the same order as import', () => {
    const row = {
      id: '1',
      parcel_id: 'PIN-1',
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
    const [headerRow, dataRow] = parseCsv(csv);
    assert.equal(headerRow.join(','), COSTAR_HEADER_ROW);
    assert.equal(headerRow.join(','), COSTAR_HEADERS.join(','));
    const values = Object.fromEntries(headerRow.map((name, index) => [name, dataRow[index] ?? '']));
    assert.equal(values['Property Address'], '1012 Poinsettia Ln');
    assert.equal(values['Property City'], 'Wendell');
    assert.equal(values['Property State'], 'NC');
    assert.equal(values['Property Type'], 'Land');
    assert.equal(values['Land Area AC'], '1.5');
    assert.equal(values['Sale Price'], '485000');
    assert.equal(values['Sale Date'], '2026-07-31');
    assert.equal(values.Zoning, 'RA');
    assert.equal(values.Market, 'Raleigh, NC');
    assert.equal(values['Parcel Number 1 (Min)'], 'PIN-1');
  });
});
