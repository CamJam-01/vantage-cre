import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchFilterEntries } from './search-filter-entries.ts';
import { emptyFilters, type LandSaleFilters } from './search-params.ts';

describe('buildSearchFilterEntries', () => {
  it('labels Market as Market, never MSA', () => {
    const applied: LandSaleFilters[] = [];
    const entries = buildSearchFilterEntries(
      { ...emptyFilters, market: 'Raleigh' },
      next => applied.push(next),
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0].kind, 'text');
    if (entries[0].kind !== 'text') return;
    assert.equal(entries[0].label, 'Market');
    assert.equal(entries[0].key, 'market');
    entries[0].remove();
    assert.equal(applied[0]?.market, undefined);
  });

  it('emits one entry per applied primary filter', () => {
    const entries = buildSearchFilterEntries({
      ...emptyFilters,
      state: 'NC',
      city: 'Wendell',
      types: ['Retail'],
    }, () => {});
    assert.deepEqual(entries.map(e => e.kind), ['state', 'text', 'type']);
  });
});
