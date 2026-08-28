import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFilters, encodeFilters, emptyFilters, hasAnyFilter } from './search-params.ts';

describe('fieldFilters in search params', () => {
  it('round-trips ff params alongside leftover search-page state', () => {
    const encoded = encodeFilters({
      state: 'NC',
      types: [],
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
      fieldFilters: [{ column: 'Zoning', kind: 'text', contains: 'RA' }],
    });
    encoded.append('ff', 'Not A Column|text|x');
    encoded.append('ff', 'broken');
    const decoded = decodeFilters(encoded);
    assert.deepEqual(decoded.fieldFilters, [{ column: 'Zoning', kind: 'text', contains: 'RA' }]);
  });

  it('counts field filters in hasAnyFilter', () => {
    assert.equal(hasAnyFilter(emptyFilters), false);
    assert.equal(hasAnyFilter({ types: [], fieldFilters: [{ column: 'Zoning', kind: 'text', contains: 'RA' }] }), true);
  });

  it('does not treat a leftover msa param as Market', () => {
    const decoded = decodeFilters(new URLSearchParams('msa=Austin&market=Raleigh'));
    assert.equal(decoded.market, 'Raleigh');
    assert.equal('msa' in decoded, false);
  });
});
