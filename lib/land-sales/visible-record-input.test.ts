import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { landSaleInputSchema } from './schema.ts';
import { mergeVisibleUpdate } from './visible-record-input.ts';

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
