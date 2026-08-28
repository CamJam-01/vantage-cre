import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chunkIds, parseExportIds } from './export-ids.ts';

describe('parseExportIds', () => {
  it('keeps unique UUIDs in the order given and drops everything else', () => {
    const a = '11111111-1111-1111-1111-111111111111';
    const b = '22222222-2222-2222-2222-222222222222';
    assert.deepEqual(parseExportIds([a, 'not-an-id', a, b, 3, null]), [a, b]);
    assert.deepEqual(parseExportIds(undefined), []);
    assert.deepEqual(parseExportIds({ ids: [a] }), []);
  });
});

describe('chunkIds', () => {
  it('splits without dropping members', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    assert.deepEqual(chunkIds(ids, 2), [['a', 'b'], ['c', 'd'], ['e']]);
    assert.deepEqual(chunkIds([], 2), []);
  });
});
