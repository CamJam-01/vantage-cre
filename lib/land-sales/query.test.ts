import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isUnsatisfiableRangeError } from './query.ts';

describe('isUnsatisfiableRangeError', () => {
  it('recognizes PostgREST 416 copy and ignores other failures', () => {
    assert.equal(isUnsatisfiableRangeError({ message: 'Requested range not satisfiable' }), true);
    assert.equal(isUnsatisfiableRangeError({ message: 'JWT expired' }), false);
    assert.equal(isUnsatisfiableRangeError(null), false);
  });
});
