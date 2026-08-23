import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LAND_SALES_FIELDS } from './database-descriptor.ts';

describe('LAND_SALES_FIELDS', () => {
  it('marks every field optional', () => {
    assert.deepEqual(
      LAND_SALES_FIELDS.filter(f => f.required).map(f => f.name),
      [],
    );
  });
});
