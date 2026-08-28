import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { coerceColumnValue, coerceLandSaleInput, columnsFromFormData, flaggedSaleDateRaw, isSystemColumn } from './schema.ts';
import { SALE_DATE_RAW_COLUMN } from './costar-fields.ts';

describe('coerceColumnValue', () => {
  it('strips currency from numbers and yields null rather than an error', () => {
    assert.equal(coerceColumnValue('Sale Price', '$1,000'), 1000);
    assert.equal(coerceColumnValue('Sale Price', 'nope'), null);
    assert.equal(coerceColumnValue('Sale Price', ''), null);
  });

  it('parses dates and booleans the same way import does', () => {
    assert.equal(coerceColumnValue('Sale Date', '8/13/2026 0:00'), '2026-08-13');
    assert.equal(coerceColumnValue('Sale Date', 'not a date'), null);
    assert.equal(coerceColumnValue('Has Lab Space', 'Yes'), true);
    assert.equal(coerceColumnValue('Has Lab Space', 'no'), false);
    assert.equal(coerceColumnValue('Has Lab Space', 'maybe'), null);
  });

  it('leaves text as trimmed text, including a full state name', () => {
    assert.equal(coerceColumnValue('Property State', 'North Carolina'), 'North Carolina');
    assert.equal(coerceColumnValue('Property State', '  NC  '), 'NC');
  });
});

describe('coerceLandSaleInput', () => {
  it('accepts an empty payload', () => {
    const { input, warnings } = coerceLandSaleInput({});
    assert.equal(input.columns['Property Address'], null);
    assert.equal(input.saleDateRaw, undefined);
    assert.deepEqual(warnings, []);
  });

  it('preserves unrecognized Sale Date text as a warning, not a rejection', () => {
    const { input, warnings } = coerceLandSaleInput({ 'Sale Date': 'spring-ish' }, 4);
    assert.equal(input.columns['Sale Date'], null);
    assert.equal(input.saleDateRaw, 'spring-ish');
    assert.match(warnings[0] ?? '', /Row 4, Sale Date/);
  });
});

describe('columnsFromFormData', () => {
  it('reads visible header names and skips hidden ones', () => {
    const form = new FormData();
    form.set('Property Address', '123 Main St');
    form.set('Zoning', 'RA');
    form.set('Sale Date', 'not-a-date');
    const input = columnsFromFormData(form, new Set(['Zoning']));
    assert.equal(input.columns['Property Address'], '123 Main St');
    assert.equal('Zoning' in input.columns, false);
    assert.equal(input.saleDateRaw, 'not-a-date');
  });
});

describe('flaggedSaleDateRaw', () => {
  it('reports the raw text only when the typed column is empty', () => {
    assert.equal(
      flaggedSaleDateRaw({ id: '1', columns: { 'Sale Date': null }, saleDateRaw: 'spring-ish' }),
      'spring-ish',
    );
    assert.equal(
      flaggedSaleDateRaw({ id: '1', columns: { 'Sale Date': '2026-08-13' }, saleDateRaw: 'spring-ish' }),
      undefined,
    );
    assert.equal(flaggedSaleDateRaw({ id: '1', columns: {} }), undefined);
  });
});

describe('system columns', () => {
  it('recognizes only the documented carve-outs as system stores', () => {
    assert.equal(isSystemColumn('id'), true);
    assert.equal(isSystemColumn(SALE_DATE_RAW_COLUMN), true);
    assert.equal(isSystemColumn('Sale Date'), false);
    assert.equal(isSystemColumn('Sprinklers'), false);
  });
});
