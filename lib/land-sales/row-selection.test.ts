import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  activateSelectionScope, keyedRecords, pageSelectionState, selectedRecords,
  togglePageSelection, toggleSelection,
} from './row-selection.ts';

describe('activateSelectionScope', () => {
  it('keeps cross-page selections for one filter and permanently clears them for another', () => {
    const unfiltered = { filtersKey: '', selectedIds: new Set(['page-1', 'page-2']) };
    assert.equal(activateSelectionScope(unfiltered, ''), unfiltered);

    const filtered = activateSelectionScope(unfiltered, 'state=NC');
    assert.equal(filtered.filtersKey, 'state=NC');
    assert.equal(filtered.selectedIds.size, 0);

    const returned = activateSelectionScope(filtered, '');
    assert.equal(returned.filtersKey, '');
    assert.equal(returned.selectedIds.size, 0);
  });
});

describe('keyedRecords', () => {
  it('keys on uuid id so Comp ID collisions cannot alias two rows', () => {
    const records = [
      { id: '11111111-1111-1111-1111-111111111111', compId: '0' },
      { id: '22222222-2222-2222-2222-222222222222', compId: '0' },
      { id: '33333333-3333-3333-3333-333333333333', compId: '7781732' },
    ];
    const keys = keyedRecords(records).map(row => row.key);
    assert.deepEqual(keys, records.map(row => row.id));
    assert.equal(new Set(keys).size, records.length);
  });
});

describe('toggleSelection', () => {
  it('selects only the clicked row when other rows share the same Comp ID', () => {
    const records = [
      { id: '11111111-1111-1111-1111-111111111111', address: 'A' },
      { id: '22222222-2222-2222-2222-222222222222', address: 'B' },
      { id: '33333333-3333-3333-3333-333333333333', address: 'C' },
    ];
    const keyed = keyedRecords(records);
    const selected = toggleSelection(new Set(), keyed[0].key);
    assert.deepEqual(selectedRecords(keyed, selected).map(row => row.address), ['A']);
    assert.equal(selected.has(keyed[1].key), false);
  });
});

describe('togglePageSelection', () => {
  it('adds this page without dropping ids selected on another page', () => {
    const other = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const page = ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc'];
    const selected = togglePageSelection(new Set([other]), page);
    assert.equal(selected.has(other), true);
    assert.equal(selected.has(page[0]), true);
    assert.equal(selected.has(page[1]), true);
  });

  it('removes only this page when every visible row is already selected', () => {
    const other = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const page = ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'];
    const selected = togglePageSelection(new Set([other, page[0]]), page);
    assert.deepEqual([...selected], [other]);
  });
});

describe('pageSelectionState', () => {
  it('reports none, some, or all of the current page', () => {
    const page = ['a', 'b'];
    assert.equal(pageSelectionState(new Set(), page), 'none');
    assert.equal(pageSelectionState(new Set(['a', 'z']), page), 'some');
    assert.equal(pageSelectionState(new Set(['a', 'b', 'z']), page), 'all');
  });
});
