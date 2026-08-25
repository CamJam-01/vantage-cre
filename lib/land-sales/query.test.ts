import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { landSaleFilterClauses } from './query.ts';

describe('landSaleFilterClauses', () => {
  it('ANDs field filters with leftover search-page params', () => {
    const clauses = landSaleFilterClauses({
      state: 'NC',
      types: [],
      sfMin: 1000,
      fieldFilters: [
        { column: 'Property City', kind: 'text', contains: 'Wendell' },
        { column: 'Sale Price', kind: 'number', min: 100, max: 500 },
        { column: 'Sale Date', kind: 'date', from: '2024-01-01', to: '2024-06-01' },
        { column: 'Has Lab Space', kind: 'boolean', value: true },
      ],
    });
    assert.deepEqual(clauses, [
      { op: 'eq', column: 'Property State', value: 'NC' },
      { op: 'gte', column: 'Land Area SF', value: 1000 },
      { op: 'ilike', column: 'Property City', value: '%Wendell%' },
      { op: 'gte', column: 'Sale Price', value: 100 },
      { op: 'lte', column: 'Sale Price', value: 500 },
      { op: 'gte', column: 'Sale Date', value: '2024-01-01' },
      { op: 'lte', column: 'Sale Date', value: '2024-06-01' },
      { op: 'eq', column: 'Has Lab Space', value: true },
    ]);
  });
});
