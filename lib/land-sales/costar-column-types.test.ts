import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { costarColumnNames } from './costar-fields.ts';
import { costarColumnType } from './costar-column-types.ts';

describe('costarColumnType', () => {
  it('maps numeric and bigint land_sales columns to number', () => {
    assert.equal(costarColumnType('Sale Price'), 'number');
    assert.equal(costarColumnType('Land Area AC'), 'number');
    assert.equal(costarColumnType('Comp ID'), 'number');
    assert.equal(costarColumnType('Assessed Year'), 'number');
  });

  it('maps timestamp columns to date', () => {
    assert.equal(costarColumnType('Sale Date'), 'date');
    assert.equal(costarColumnType('Publication Date'), 'date');
    assert.equal(costarColumnType('Recording Date'), 'date');
  });

  it('maps boolean columns to boolean', () => {
    assert.equal(costarColumnType('Has Lab Space'), 'boolean');
  });

  it('maps remaining CoStar headers to text, including unknown names', () => {
    assert.equal(costarColumnType('Property City'), 'text');
    assert.equal(costarColumnType('Zoning'), 'text');
    assert.equal(costarColumnType('Not A Real Column'), 'text');
    for (const name of costarColumnNames()) {
      assert.equal(['text', 'number', 'date', 'boolean'].includes(costarColumnType(name)), true);
    }
  });
});
