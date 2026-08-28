import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COSTAR_HEADERS,
  SALE_DATE_RAW_COLUMN,
  costarColumnNames,
  costarFields,
} from './costar-fields.ts';

describe('costarFields', () => {
  it('keeps CoStar header order and uses the exact header as the column name', () => {
    const fields = costarFields();
    assert.equal(fields.length, 278);
    assert.equal(fields[0]?.header, 'Property Address');
    assert.equal(fields[0]?.column, 'Property Address');
    assert.equal(fields.some(field => field.column === SALE_DATE_RAW_COLUMN), false);
    assert.equal(costarColumnNames().includes('id'), false);
    assert.equal(costarColumnNames().includes(SALE_DATE_RAW_COLUMN), false);
  });

  it('maps the duplicate Sprinklers header onto one column name', () => {
    const sprinklers = costarFields().filter(f => f.header === 'Sprinklers');
    assert.deepEqual(sprinklers.map(f => f.column), ['Sprinklers', 'Sprinklers']);
    assert.equal(costarColumnNames().length, COSTAR_HEADERS.length - 1);
  });

  it('still maps an explicit header list when one is passed', () => {
    assert.deepEqual(costarColumnNames(['A', 'A', 'B']), ['A', 'B']);
    assert.deepEqual(costarFields(['Zoning', 'Zoning']), [
      { header: 'Zoning', column: 'Zoning' },
      { header: 'Zoning', column: 'Zoning' },
    ]);
  });

  it('returns a fresh array so callers cannot mutate the module defaults', () => {
    const names = costarColumnNames();
    names.push('mutated');
    assert.equal(costarColumnNames().includes('mutated'), false);
    const fields = costarFields();
    fields.pop();
    assert.equal(costarFields().length, 278);
  });
});
