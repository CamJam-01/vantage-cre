import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { landSaleFromRow, landSaleToRow, projectVisibleLandSale } from './db.ts';
import { SALE_DATE_RAW_COLUMN } from './costar-fields.ts';

describe('landSaleFromRow', () => {
  it('requires the uuid id and does not fall back to Comp ID', () => {
    const missing = landSaleFromRow({
      'Comp ID': 0,
      'Property Address': '1 Duplicate St',
    });
    assert.equal(missing, null);

    const record = landSaleFromRow({
      id: '11111111-1111-1111-1111-111111111111',
      'Comp ID': 0,
      'Property Address': '1 Duplicate St',
    });
    assert.equal(record?.id, '11111111-1111-1111-1111-111111111111');
  });

  it('reads exact CoStar column names onto the record columns map', () => {
    const record = landSaleFromRow({
      id: '22222222-2222-2222-2222-222222222222',
      'Comp ID': 7781732,
      'Property Address': '123 Main St',
      'Property City': 'Wendell',
      Market: 'Raleigh',
      'Sale Price': 485000,
      'Sale Date': '2026-07-31',
      [SALE_DATE_RAW_COLUMN]: 'July 31st-ish',
    });
    assert.ok(record);
    assert.equal(record.columns['Property Address'], '123 Main St');
    assert.equal(record.columns['Property City'], 'Wendell');
    assert.equal(record.columns.Market, 'Raleigh');
    assert.equal(record.columns['Sale Price'], 485000);
    assert.equal(record.saleDateRaw, 'July 31st-ish');
    assert.equal('parcel_id' in record.columns, false);
    assert.equal('address' in record, false);
  });
});

describe('projectVisibleLandSale', () => {
  it('keeps identity and drops catalog values that are not in the visible set', () => {
    const record = landSaleFromRow({
      id: '22222222-2222-2222-2222-222222222222',
      'Property Address': '123 Main St',
      Zoning: 'RA',
      [SALE_DATE_RAW_COLUMN]: 'July 31st-ish',
    });
    assert.ok(record);
    const visible = projectVisibleLandSale(record, new Set(['Property Address']));
    assert.equal(visible.id, record.id);
    assert.equal(visible.columns['Property Address'], '123 Main St');
    assert.equal('Zoning' in visible.columns, false);
    assert.equal(visible.saleDateRaw, 'July 31st-ish');
  });
});

describe('landSaleToRow', () => {
  it('writes header-keyed columns onto exact CoStar names plus the raw-date store', () => {
    const row = landSaleToRow({
      columns: {
        'Property Address': '123 Main St',
        'Property City': 'Wendell',
        'Sale Price': 1000,
      },
      saleDateRaw: 'not a date',
    });
    assert.equal(row['Property Address'], '123 Main St');
    assert.equal(row['Property City'], 'Wendell');
    assert.equal(row['Sale Price'], 1000);
    assert.equal(row[SALE_DATE_RAW_COLUMN], 'not a date');
    assert.equal('parcel_id' in row, false);
    assert.equal('address' in row, false);
  });
});
