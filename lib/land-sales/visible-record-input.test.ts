import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { landSaleInputSchema } from './schema.ts';
import { mergeVisibleUpdate, sanitizeVisibleCreate } from './visible-record-input.ts';

describe('mergeVisibleUpdate', () => {
  const existing = landSaleInputSchema.parse({
    parcel_id: 'LND-1',
    address: 'Stored Address',
    city: 'Austin',
    buyer: 'Stored Buyer',
    sale_date: '2026-08-01',
    sale_date_raw: 'August 1, 2026',
    extras: { Zoning: 'C-2', Market: 'Austin', Legacy: 'Keep me' },
  });

  it('preserves hidden core and custom values while applying visible edits', () => {
    const submitted = landSaleInputSchema.parse({
      parcel_id: 'LND-1',
      address: 'Crafted replacement',
      city: 'Dallas',
      buyer: '',
      extras: { Zoning: 'Crafted' },
    });
    const merged = mergeVisibleUpdate(
      existing,
      submitted,
      ['Zoning', 'Market', 'Legacy'],
      new Set(['core:address', 'extra:Zoning']),
    );

    assert.equal(merged.address, 'Stored Address');
    assert.equal(merged.city, 'Dallas');
    assert.equal(merged.buyer, '');
    assert.equal(merged.extras.Zoning, 'C-2');
    assert.equal('Market' in merged.extras, false);
    assert.equal('Legacy' in merged.extras, false);
  });

  it('preserves custom values outside the authoritative editable field list', () => {
    const submitted = landSaleInputSchema.parse({ city: 'Dallas', extras: {} });
    const merged = mergeVisibleUpdate(
      existing,
      submitted,
      ['Zoning', 'Market'],
      new Set(),
    );

    assert.equal(merged.extras.Legacy, 'Keep me');
  });

  it('ignores crafted custom values outside the authoritative field list', () => {
    const submitted = landSaleInputSchema.parse({
      city: 'Dallas',
      extras: { Injected: 'Not allowed' },
    });
    const merged = mergeVisibleUpdate(existing, submitted, ['Zoning', 'Market', 'Legacy'], new Set());

    assert.equal('Injected' in merged.extras, false);
  });
});

describe('sanitizeVisibleCreate', () => {
  it('drops crafted hidden and unknown values while retaining visible inputs', () => {
    const submitted = landSaleInputSchema.parse({
      address: 'Hidden address',
      city: 'Dallas',
      buyer: 'Visible buyer',
      extras: {
        Zoning: 'Hidden zoning',
        Market: 'Dallas-Fort Worth',
        Injected: 'Not allowed',
      },
    });
    const sanitized = sanitizeVisibleCreate(
      submitted,
      ['Zoning', 'Market'],
      new Set(['core:address', 'extra:Zoning']),
    );

    assert.equal(sanitized.address, '');
    assert.equal(sanitized.city, 'Dallas');
    assert.equal(sanitized.buyer, 'Visible buyer');
    assert.deepEqual(sanitized.extras, { Market: 'Dallas-Fort Worth' });
  });

  it('removes a crafted hidden sale date and its raw import value', () => {
    const submitted = landSaleInputSchema.parse({
      sale_date: '2026-08-01',
      sale_date_raw: 'August 1, 2026',
    });
    const sanitized = sanitizeVisibleCreate(
      submitted,
      [],
      new Set(['core:sale_date']),
    );

    assert.equal(sanitized.sale_date, undefined);
    assert.equal(sanitized.sale_date_raw, undefined);
  });

  it('does not accept the computed price per acre as manual input', () => {
    const submitted = landSaleInputSchema.parse({
      sale_price: 500000,
      acreage: 2,
      price_per_acre: 1,
    });
    const sanitized = sanitizeVisibleCreate(submitted, [], new Set());

    assert.equal('price_per_acre' in sanitized, false);
  });
});
