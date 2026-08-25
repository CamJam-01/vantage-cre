import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { landSaleFromRow, landSaleToRow } from './db.ts';
import { landSaleInputSchema } from './schema.ts';

describe('landSaleFromRow', () => {
  it('prefers the unique row id over Comp ID for routing', () => {
    const record = landSaleFromRow({
      id: '11111111-1111-1111-1111-111111111111',
      'Comp ID': 0,
      'Property Address': '1 Duplicate St',
      'Property City': 'Raleigh',
      'Property State': 'NC',
      'Property County': 'Wake',
      'Property Type': 'Land',
    });
    assert.equal(record.id, '11111111-1111-1111-1111-111111111111');
  });

  it('reads exact CoStar column names onto the app record shape', () => {
    const record = landSaleFromRow({
      id: '22222222-2222-2222-2222-222222222222',
      'Comp ID': 7781732,
      'Property Address': '123 Main St',
      'Property City': 'Wendell',
      'Property State': 'NC',
      'Property County': 'Wake',
      'Market': 'Raleigh',
      'Property Type': 'Land',
      'Land Area AC': '1.5',
      'Land Area SF': 65340,
      'Sale Price': 485000,
      'Sale Date': '2026-07-31',
      'Buyer (True) Company': 'Acme LLC',
      'Parcel Number 1 (Min)': 'PIN-1',
      created_at: 't1',
      updated_at: 't2',
    });
    assert.equal(record.address, '123 Main St');
    assert.equal(record.city, 'Wendell');
    assert.equal(record.state, 'NC');
    assert.equal(record.county, 'Wake');
    assert.equal(record.msa, 'Raleigh');
    assert.equal(record.acreage, 1.5);
    assert.equal(record.square_feet, 65340);
    assert.equal(record.sale_price, 485000);
    assert.equal(record.price_per_acre, 323333.33);
    assert.equal(record.buyer, 'Acme LLC');
    assert.equal(record.parcel_id, 'PIN-1');
    assert.equal(record.id, '22222222-2222-2222-2222-222222222222');
    assert.equal(record.extras['Property Address'], '123 Main St');
    assert.equal(record.extras['Buyer (True) Company'], 'Acme LLC');
    assert.equal('parcel_id' in record.extras, false);
  });
});

describe('landSaleToRow', () => {
  it('writes core fields onto exact CoStar column names', () => {
    const row = landSaleToRow(landSaleInputSchema.parse({
      address: '123 Main St',
      city: 'Wendell',
      state: 'nc',
      sale_price: 1000,
    }));
    assert.equal(row['Property Address'], '123 Main St');
    assert.equal(row['Property City'], 'Wendell');
    assert.equal(row['Property State'], 'NC');
    assert.equal(row['Sale Price'], 1000);
    assert.equal('parcel_id' in row, false);
    assert.equal('address' in row, false);
  });

  it('writes CoStar extras onto matching column names', () => {
    const row = landSaleToRow(landSaleInputSchema.parse({
      extras: {
        'Property Address': '9 Pine St',
        Zoning: 'RA',
        'Has Lab Space': 'Yes',
      },
    }));
    assert.equal(row['Property Address'], '9 Pine St');
    assert.equal(row.Zoning, 'RA');
    assert.equal(row['Has Lab Space'], true);
    assert.equal(row['Property City'], null);
  });
});
