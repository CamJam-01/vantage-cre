import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { keyedRecords, selectedRecords, toggleSelection } from './row-selection.ts';

describe('keyedRecords', () => {
  it('gives each row a unique key even when Comp IDs collide', () => {
    const records = [{ id: '0' }, { id: '0' }, { id: '7781732' }];
    const keys = keyedRecords(records).map(row => row.key);
    assert.equal(new Set(keys).size, records.length);
  });
});

describe('toggleSelection', () => {
  it('selects only the clicked row when other rows share the same Comp ID', () => {
    const records = [{ id: '0', address: 'A' }, { id: '0', address: 'B' }, { id: '7781732', address: 'C' }];
    const keyed = keyedRecords(records);
    const selected = toggleSelection(new Set(), keyed[0].key);
    assert.deepEqual(selectedRecords(keyed, selected).map(row => row.address), ['A']);
    assert.equal(selected.has(keyed[1].key), false);
  });
});
