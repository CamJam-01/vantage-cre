import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DATABASE_CATEGORIES } from './database-descriptor.ts';

describe('DATABASE_CATEGORIES', () => {
  it('treats only Land Sales as available', () => {
    assert.deepEqual(
      DATABASE_CATEGORIES.filter(c => c.available).map(c => c.key),
      ['sales'],
    );
  });
});
