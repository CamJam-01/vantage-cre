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
      proposedUses: ['Office'],
    }, () => {});
    assert.deepEqual(entries.map(e => e.kind), ['state', 'text', 'type', 'proposedUse']);
  });

  it('removes a proposed-use chip without touching secondary types', () => {
    const applied: LandSaleFilters[] = [];
    const entries = buildSearchFilterEntries({
      ...emptyFilters,
      types: ['Retail'],
      proposedUses: ['Office', 'Industrial'],
    }, next => applied.push(next));
    const office = entries.find(e => e.kind === 'proposedUse' && e.value === 'Office');
    assert.equal(office?.kind, 'proposedUse');
    if (office?.kind !== 'proposedUse') return;
    office.remove();
    assert.deepEqual(applied[0]?.types, ['Retail']);
    assert.deepEqual(applied[0]?.proposedUses, ['Industrial']);
  });
});
