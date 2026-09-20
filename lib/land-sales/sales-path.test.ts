import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  IMPROVED_SALES_PATH,
  LAND_SALES_PATH,
  salesPathFromDatabaseKey,
  salesPathFromId,
  selectionFiltersKey,
} from './sales-path.ts';

describe('salesPathFromId', () => {
  it('resolves the two sales property-type paths and rejects anything else', () => {
    assert.equal(salesPathFromId('land'), LAND_SALES_PATH);
    assert.equal(salesPathFromId('improved'), IMPROVED_SALES_PATH);
    assert.equal(salesPathFromId('ground-leases'), null);
    assert.equal(salesPathFromId('sales'), null);
  });
});

describe('salesPathFromDatabaseKey', () => {
  it('maps arrangement keys onto the matching path', () => {
    assert.equal(salesPathFromDatabaseKey('sales'), LAND_SALES_PATH);
    assert.equal(salesPathFromDatabaseKey('improved-sales'), IMPROVED_SALES_PATH);
    assert.equal(salesPathFromDatabaseKey('rentals'), null);
  });
});

describe('selectionFiltersKey', () => {
  it('prefixes the encoded filters so Land and Improved selections stay apart', () => {
    assert.equal(selectionFiltersKey(LAND_SALES_PATH, 'state=TX'), 'land:state=TX');
    assert.equal(selectionFiltersKey(IMPROVED_SALES_PATH, 'state=TX'), 'improved:state=TX');
  });
});
