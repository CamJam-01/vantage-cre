import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ResultColumn } from './result-columns.ts';
import {
  addFilterCandidates,
  appliedToDraft,
  compactDraftFilters,
  decodeFieldFilter,
  draftsDiffer,
  emptyDraftFilter,
  encodeFieldFilter,
  type DraftFieldFilter,
  type FieldFilter,
} from './field-filters.ts';

const known = new Set(['Property City', 'Sale Price', 'Land Area AC', 'Sale Date', 'Recording Date', 'Has Lab Space', 'Zoning']);

const columns: ResultColumn[] = [
  { key: 'Property City', label: 'Property City' },
  { key: 'Property County', label: 'Property County' },
  { key: 'Zoning', label: 'Zoning' },
];

describe('encodeFieldFilter / decodeFieldFilter', () => {
  it('round-trips each kind, including one-sided ranges', () => {
    const samples: FieldFilter[] = [
      { column: 'Property City', kind: 'text', contains: 'Wendell' },
      { column: 'Sale Price', kind: 'number', min: 100, max: 500 },
      { column: 'Sale Price', kind: 'number', min: 100 },
      { column: 'Land Area AC', kind: 'number', max: 5 },
      { column: 'Sale Date', kind: 'date', from: '2024-01-01', to: '2024-12-31' },
      { column: 'Sale Date', kind: 'date', from: '2024-01-01' },
      { column: 'Recording Date', kind: 'date', to: '2024-12-31' },
      { column: 'Has Lab Space', kind: 'boolean', value: true },
    ];
    for (const filter of samples) {
      assert.deepEqual(decodeFieldFilter(encodeFieldFilter(filter), known), filter);
    }
  });

  it('ignores malformed values, unknown kinds, and unknown columns', () => {
    assert.equal(decodeFieldFilter('not-a-filter', known), null);
    assert.equal(decodeFieldFilter('Property City|nope|x', known), null);
    assert.equal(decodeFieldFilter('Not A Column|text|x', known), null);
  });

  it('last well-formed duplicate column wins when decoding a list', () => {
    const first = decodeFieldFilter(encodeFieldFilter({ column: 'Zoning', kind: 'text', contains: 'RA' }), known);
    const second = decodeFieldFilter(encodeFieldFilter({ column: 'Zoning', kind: 'text', contains: 'R-1' }), known);
    const byColumn = new Map<string, FieldFilter>();
    for (const filter of [first, second]) {
      if (filter) byColumn.set(filter.column, filter);
    }
    assert.deepEqual(byColumn.get('Zoning'), { column: 'Zoning', kind: 'text', contains: 'R-1' });
  });
});

describe('compactDraftFilters', () => {
  it('omits empty text, number, date, and unset boolean drafts', () => {
    const draft: DraftFieldFilter[] = [
      { column: 'Property City', kind: 'text', contains: '' },
      { column: 'Sale Price', kind: 'number', min: '', max: '' },
      { column: 'Sale Date', kind: 'date', from: '', to: '' },
      { column: 'Has Lab Space', kind: 'boolean', value: '' },
      { column: 'Zoning', kind: 'text', contains: 'RA' },
    ];
    assert.deepEqual(compactDraftFilters(draft), [{ column: 'Zoning', kind: 'text', contains: 'RA' }]);
  });
});

describe('draftsDiffer', () => {
  it('treats an extra empty drafted field as dirty', () => {
    const applied: FieldFilter[] = [{ column: 'Zoning', kind: 'text', contains: 'RA' }];
    const draft = [
      ...appliedToDraft(applied),
      emptyDraftFilter('Property City'),
    ];
    assert.equal(draftsDiffer(draft, applied), true);
    assert.equal(draftsDiffer(appliedToDraft(applied), applied), false);
  });
});

describe('addFilterCandidates', () => {
  it('lists visible columns minus drafted, filtered by query, and never includes omitted fields', () => {
    const visible = columns.filter(c => c.key !== 'Zoning');
    const matches = addFilterCandidates(visible, ['Property City'], 'property ci');
    assert.equal(matches.some(c => c.key === 'Property City'), false);
    assert.equal(matches.some(c => c.key === 'Zoning'), false);
    const cityMatches = addFilterCandidates(visible, [], 'property city');
    assert.equal(cityMatches.some(c => c.key === 'Property City'), true);
    assert.equal(cityMatches.some(c => c.key === 'Zoning'), false);
  });
});
