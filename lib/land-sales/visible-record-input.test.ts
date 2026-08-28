import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeVisibleUpdate, sanitizeVisibleCreate } from './visible-record-input.ts';
import type { LandSale, LandSaleInput } from './schema.ts';

function sale(columns: Record<string, unknown>, extras: Partial<LandSale> = {}): LandSale {
  return { id: '1', columns, saleDateRaw: extras.saleDateRaw };
}

function input(columns: Record<string, unknown>, saleDateRaw?: string): LandSaleInput {
  return { columns, saleDateRaw };
}

describe('mergeVisibleUpdate', () => {
  const existing = sale({
    'Parcel Number 1 (Min)': 'LND-1',
    'Property Address': 'Stored Address',
    'Property City': 'Austin',
    'Buyer (True) Company': 'Stored Buyer',
    'Sale Date': '2026-08-01',
    Zoning: 'C-2',
    Market: 'Austin',
    Legacy: 'Keep me',
  }, { saleDateRaw: 'August 1, 2026' });

  it('preserves hidden values while applying visible edits', () => {
    const merged = mergeVisibleUpdate(
      existing,
      input({
        'Parcel Number 1 (Min)': 'LND-1',
        'Property Address': 'Crafted replacement',
        'Property City': 'Dallas',
        'Buyer (True) Company': '',
        Zoning: 'Crafted',
      }),
      new Set(['Property Address', 'Zoning']),
    );

    assert.equal(merged.columns['Property Address'], 'Stored Address');
    assert.equal(merged.columns['Property City'], 'Dallas');
    assert.equal(merged.columns['Buyer (True) Company'], '');
    assert.equal(merged.columns.Zoning, 'C-2');
  });

  it('keeps catalog values the form did not submit', () => {
    const merged = mergeVisibleUpdate(
      existing,
      input({ 'Property City': 'Dallas' }),
      new Set(),
    );
    assert.equal(merged.columns.Legacy, 'Keep me');
  });

  it('ignores crafted values for headers that are not in the catalog', () => {
    const merged = mergeVisibleUpdate(
      existing,
      input({ 'Property City': 'Dallas', Injected: 'Not allowed' }),
      new Set(),
    );
    assert.equal('Injected' in merged.columns, false);
  });
});

describe('sanitizeVisibleCreate', () => {
  it('drops hidden and unknown values while retaining visible inputs', () => {
    const sanitized = sanitizeVisibleCreate(
      input({
        'Property Address': 'Hidden address',
        'Property City': 'Dallas',
        'Buyer (True) Company': 'Visible buyer',
        Zoning: 'Hidden zoning',
        Market: 'Dallas-Fort Worth',
        Injected: 'Not allowed',
      }),
      new Set(['Property Address', 'Zoning']),
    );

    assert.equal(sanitized.columns['Property Address'], undefined);
    assert.equal(sanitized.columns['Property City'], 'Dallas');
    assert.equal(sanitized.columns['Buyer (True) Company'], 'Visible buyer');
    assert.equal(sanitized.columns.Market, 'Dallas-Fort Worth');
    assert.equal('Zoning' in sanitized.columns && sanitized.columns.Zoning != null, false);
    assert.equal('Injected' in sanitized.columns, false);
  });

  it('removes a crafted hidden sale date and its raw import value', () => {
    const sanitized = sanitizeVisibleCreate(
      input({ 'Sale Date': '2026-08-01' }, 'August 1, 2026'),
      new Set(['Sale Date']),
    );
    assert.equal(sanitized.columns['Sale Date'], undefined);
    assert.equal(sanitized.saleDateRaw, undefined);
  });
});
