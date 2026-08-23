import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COSTAR_HEADERS,
  COSTAR_TYPED_COLUMNS,
  costarFields,
  costarTextColumns,
} from './costar-fields.ts';

describe('costarFields', () => {
  it('keeps CoStar header order and unique snake_case column names', () => {
    const fields = costarFields();
    assert.equal(fields.length, 278);
    assert.equal(fields[0]?.header, 'Property Address');
    assert.equal(fields[0]?.column, 'property_address');
    assert.equal(new Set(fields.map(f => f.column)).size, fields.length);
  });

  it('disambiguates the duplicate Sprinklers header', () => {
    const sprinklers = costarFields().filter(f => f.header === 'Sprinklers');
    assert.deepEqual(sprinklers.map(f => f.column), ['sprinklers', 'sprinklers_2']);
  });

  it('does not add a second text column for typed core names', () => {
    for (const column of COSTAR_TYPED_COLUMNS) {
      assert.equal(costarTextColumns().includes(column), false);
    }
    assert.equal(costarTextColumns().length, COSTAR_HEADERS.length - COSTAR_TYPED_COLUMNS.length);
  });
});
