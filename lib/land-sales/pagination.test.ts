import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGE_SIZE,
  MAX_PAGE,
  decodePage,
  encodePage,
  lastPage,
  landSalesPageHref,
  pageRange,
  resultsRangeLabel,
} from './pagination.ts';
import { emptyFilters } from './search-params.ts';

describe('decodePage', () => {
  it('yields 1 for missing, empty, and every malformed input', () => {
    assert.equal(decodePage(undefined), 1);
    assert.equal(decodePage(''), 1);
    assert.equal(decodePage('abc'), 1);
    assert.equal(decodePage('-4'), 1);
    assert.equal(decodePage('0'), 1);
    assert.equal(decodePage('99.5'), 1);
    assert.equal(decodePage(-4), 1);
    assert.equal(decodePage(0), 1);
    assert.equal(decodePage(99.5), 1);
    assert.equal(decodePage(['abc']), 1);
    assert.equal(decodePage(String(MAX_PAGE + 1)), 1);
    assert.equal(decodePage(Number.MAX_SAFE_INTEGER), 1);
  });

  it('accepts a positive integer, including as the first of several values', () => {
    assert.equal(decodePage('1'), 1);
    assert.equal(decodePage('2'), 2);
    assert.equal(decodePage(4), 4);
    assert.equal(decodePage(['3', '9']), 3);
    assert.equal(decodePage(String(MAX_PAGE)), MAX_PAGE);
  });
});

describe('encodePage / round trip', () => {
  it('omits page 1 from the URL and round-trips higher pages', () => {
    assert.equal(encodePage(1), null);
    assert.equal(encodePage(2), '2');
    assert.equal(encodePage(0), null);
    assert.equal(encodePage(1.5), null);
    assert.equal(encodePage(MAX_PAGE + 1), null);
    assert.equal(decodePage(encodePage(7)), 7);
    assert.equal(encodePage(decodePage('7')), '7');
    assert.equal(encodePage(decodePage('abc')), null);
  });
});

describe('pageRange / resultsRangeLabel / href', () => {
  it('maps a page onto an inclusive PostgREST range', () => {
    assert.deepEqual(pageRange(1), { from: 0, to: PAGE_SIZE - 1 });
    assert.deepEqual(pageRange(2), { from: PAGE_SIZE, to: PAGE_SIZE * 2 - 1 });
    assert.deepEqual(pageRange(MAX_PAGE + 1), { from: 0, to: PAGE_SIZE - 1 });
  });

  it('calculates a canonical final page', () => {
    assert.equal(lastPage(0), 1);
    assert.equal(lastPage(1), 1);
    assert.equal(lastPage(50), 1);
    assert.equal(lastPage(51), 2);
    assert.equal(lastPage(196), 4);
  });

  it('describes the visible slice without using the page array length as the total', () => {
    assert.equal(resultsRangeLabel(1, 196, 50), 'showing 1–50 of 196');
    assert.equal(resultsRangeLabel(4, 196, 46), 'showing 151–196 of 196');
    assert.equal(resultsRangeLabel(1, 0, 0), 'showing 0 of 0');
    assert.equal(resultsRangeLabel(999999, 196, 0), 'showing 0 of 196');
  });

  it('keeps filters in the pager href and drops page 1', () => {
    assert.equal(landSalesPageHref(emptyFilters, 1), '/land-sales');
    assert.equal(landSalesPageHref({ ...emptyFilters, state: 'TX' }, 2), '/land-sales?state=TX&page=2');
  });
});
