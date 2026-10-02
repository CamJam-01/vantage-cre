import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFilters, encodeFilters, emptyFilters, hasAnyFilter, appliedFilterCount } from './search-params.ts';

describe('building area search params', () => {
  it('round-trips building SF independently from land ranges', () => {
    const filters = { ...emptyFilters, sfMin: 1000, acMax: 3, buildingSfMin: 0, buildingSfMax: 50000 };
    const decoded = decodeFilters(encodeFilters(filters));
    for (const [key, value] of Object.entries(filters)) {
      assert.deepEqual(decoded[key as keyof typeof decoded], value);
    }
    assert.equal(appliedFilterCount(decoded), 2);
    assert.equal(hasAnyFilter({ ...emptyFilters, buildingSfMin: 0 }), true);
  });

  it('ignores malformed building ranges and stale acreage params', () => {
    const decoded = decodeFilters(new URLSearchParams('buildingSfMin=broken&buildingSfMax=Infinity&buildingAcMin=0&buildingAcMax=1.5'));
    assert.equal(decoded.buildingSfMin, undefined);
    assert.equal(decoded.buildingSfMax, undefined);
    assert.equal(hasAnyFilter(decoded), false);
    assert.equal(appliedFilterCount(decoded), 0);
    assert.equal(encodeFilters(decoded).toString(), '');
  });
});

describe('fieldFilters in search params', () => {
  it('round-trips ff params alongside leftover search-page state', () => {
    const encoded = encodeFilters({
      state: 'NC',
      types: [],
      proposedUses: [],
      sfMin: 1000,
      fieldFilters: [
        { column: 'Property City', kind: 'text', contains: 'Wendell' },
        { column: 'Sale Price', kind: 'number', min: 100 },
      ],
    });
    assert.equal(encoded.get('state'), 'NC');
    assert.equal(encoded.get('sfMin'), '1000');
    const decoded = decodeFilters(encoded);
    assert.equal(decoded.state, 'NC');
    assert.equal(decoded.sfMin, 1000);
    assert.deepEqual(decoded.fieldFilters, [
      { column: 'Property City', kind: 'text', contains: 'Wendell' },
      { column: 'Sale Price', kind: 'number', min: 100 },
    ]);
  });

  it('omits empty field filters and ignores unknown ff columns', () => {
    const encoded = encodeFilters({
      types: [],
      proposedUses: [],
      fieldFilters: [{ column: 'Zoning', kind: 'text', contains: 'RA' }],
    });
    encoded.append('ff', 'Not A Column|text|x');
    encoded.append('ff', 'broken');
    const decoded = decodeFilters(encoded);
    assert.deepEqual(decoded.fieldFilters, [{ column: 'Zoning', kind: 'text', contains: 'RA' }]);
  });

  it('counts field filters in hasAnyFilter', () => {
    assert.equal(hasAnyFilter(emptyFilters), false);
    assert.equal(hasAnyFilter({ types: [], proposedUses: [], fieldFilters: [{ column: 'Zoning', kind: 'text', contains: 'RA' }] }), true);
    assert.equal(hasAnyFilter({ types: [], proposedUses: ['Retail'] }), true);
  });

  it('round-trips repeated proposedUse params', () => {
    const encoded = encodeFilters({
      types: ['Industrial'],
      proposedUses: ['Retail', 'Office'],
    });
    assert.deepEqual(encoded.getAll('type'), ['Industrial']);
    assert.deepEqual(encoded.getAll('proposedUse'), ['Retail', 'Office']);
    const decoded = decodeFilters(encoded);
    assert.deepEqual(decoded.types, ['Industrial']);
    assert.deepEqual(decoded.proposedUses, ['Retail', 'Office']);
  });

  it('does not treat a leftover msa param as Market', () => {
    const decoded = decodeFilters(new URLSearchParams('msa=Austin&market=Raleigh'));
    assert.equal(decoded.market, 'Raleigh');
    assert.equal('msa' in decoded, false);
  });
});
