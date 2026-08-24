import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COSTAR_HEADERS,
  costarColumnNames,
  costarFields,
} from './costar-fields.ts';

describe('costarFields', () => {
  it('keeps CoStar header order and uses the exact header as the column name', () => {
    const fields = costarFields();
    assert.equal(fields.length, 278);
    assert.equal(fields[0]?.header, 'Property Address');
    assert.equal(fields[0]?.column, 'Property Address');
    assert.equal(fields.some(field => field.column === 'parcel_id'), false);
    assert.equal(fields.some(field => field.column === 'address'), false);
  });

  it('maps the duplicate Sprinklers header onto one column name', () => {
    const sprinklers = costarFields().filter(f => f.header === 'Sprinklers');
    assert.deepEqual(sprinklers.map(f => f.column), ['Sprinklers', 'Sprinklers']);
    assert.equal(costarColumnNames().length, COSTAR_HEADERS.length - 1);
  });
});
