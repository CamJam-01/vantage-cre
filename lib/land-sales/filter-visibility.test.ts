import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveSearchFilters,
  readHiddenFilterKeys,
  searchFilterColumns,
  validateSearchFilterSelection,
} from './filter-visibility.ts';
import { decodeFilters, encodeFilters, hasAnyFilter } from './search-params.ts';
import { landSaleFilterClauses } from './query.ts';
import { buildRecordDisplayPages, fieldDisplayRows } from './field-visibility.ts';
import { resultColumns } from './result-columns.ts';

describe('search filter configuration', () => {
  it('accepts only known strings from untrusted stored configuration', () => {
    assert.deepEqual(readHiddenFilterKeys(null), []);
    assert.deepEqual(readHiddenFilterKeys('Zoning'), []);
    assert.deepEqual(readHiddenFilterKeys(['Zoning', null, 7, {}, 'obsolete', 'Zoning', '_verified_by']), ['Zoning', '_verified_by']);
  });

  for (const pathId of ['land', 'improved'] as const) {
    it(`${pathId}: filter visibility does not alter the columns or record arrangement`, () => {
      const columns = resultColumns({ pathId });
      const before = structuredClone(columns);
      const hiddenFields = new Set(['Property State']);
      const hiddenFilters = new Set(['Transaction Notes', '_verified_by']);
      const allowed = searchFilterColumns(columns, hiddenFields, hiddenFilters);
      assert.equal(allowed.some(column => hiddenFields.has(column.key) || hiddenFilters.has(column.key)), false);
      assert.equal(allowed.length, columns.length - 3);
      const recordPages = buildRecordDisplayPages(fieldDisplayRows(columns, []), hiddenFields);
      const searchPages = buildRecordDisplayPages(fieldDisplayRows(columns, []), new Set([...hiddenFields, ...hiddenFilters]));
      const keys = (pages: typeof recordPages) => pages.flatMap(page => page.items.flatMap(item => item.kind === 'field' ? [item.column.key] : []));
      assert.equal(keys(recordPages).includes('Transaction Notes'), true);
      assert.equal(keys(recordPages).includes('_verified_by'), true);
      assert.deepEqual(keys(searchPages), allowed.map(column => column.key));
      assert.deepEqual(columns, before);
    });
  }

  it('keeps Land and Improved preferences independent', () => {
    const land = searchFilterColumns(resultColumns(), new Set(), new Set(['Zoning']));
    const improved = searchFilterColumns(resultColumns({ pathId: 'improved' }), new Set(), new Set(['Sale Date']));
    assert.equal(land.some(column => column.key === 'Zoning'), false);
    assert.equal(improved.some(column => column.key === 'Zoning'), true);
    assert.equal(land.some(column => column.key === 'Sale Date'), true);
    assert.equal(improved.some(column => column.key === 'Sale Date'), false);
  });

  it('removes empty groups and pages when every filter in them is hidden', () => {
    const rows = fieldDisplayRows(
      [{ key: 'Zoning', label: 'Zoning' }, { key: 'Sale Date', label: 'Sale Date' }],
      ['page:site', 'group:g', 'Zoning', 'page:sale', 'Sale Date'],
      [{ id: 'site', kind: 'page', label: 'Site' }, { id: 'g', kind: 'group', label: 'Group' }, { id: 'sale', kind: 'page', label: 'Sale' }],
    );
    assert.deepEqual(buildRecordDisplayPages(rows, new Set(['Zoning'])).map(page => page.title), ['Sale']);
    assert.deepEqual(buildRecordDisplayPages(rows, new Set(['Zoning', 'Sale Date'])), []);
  });
});

describe('effective bookmark filters', () => {
  const url = new URLSearchParams({
    state: 'NC', city: 'Raleigh', county: 'Wake', market: 'Triangle',
    type: 'Office', proposedUse: 'Industrial', sfMin: '1', sfMax: '2',
    acMin: '3', acMax: '4', buildingSfMin: '5', buildingSfMax: '6',
    dateFrom: '2024-01-01', dateTo: '2025-01-01',
  });
  url.append('ff', 'Transaction Notes|text|owner');
  url.append('ff', '_verified_by|text|Custom name');
  url.append('ff', 'Zoning|text|R');

  it('drops hidden criteria in modern and legacy URLs without editing the URL or decoded state', () => {
    const originalUrl = url.toString();
    const decoded = decodeFilters(url);
    const originalState = structuredClone(decoded);
    const onlyZoning = [{ key: 'Zoning', label: 'Zoning' }];
    const effective = effectiveSearchFilters(decoded, onlyZoning);
    assert.deepEqual(landSaleFilterClauses(effective), [{ op: 'ilike', column: 'Zoning', value: '%R%' }]);
    assert.equal(url.toString(), originalUrl);
    assert.deepEqual(decoded, originalState);
    assert.deepEqual(decodeFilters(encodeFilters(effective)), effective);
  });

  const legacyGroups = [
    { column: 'Property State', params: ['state'] },
    { column: 'Property City', params: ['city'] },
    { column: 'Property County', params: ['county'] },
    { column: 'Market', params: ['market'] },
    { column: 'Secondary Type', params: ['type'] },
    { column: 'Proposed Use', params: ['proposedUse'] },
    { column: 'Land Area SF', params: ['sfMin', 'sfMax'] },
    { column: 'Land Area AC', params: ['acMin', 'acMax'] },
    { column: 'Building SF', params: ['buildingSfMin', 'buildingSfMax'] },
    { column: 'Sale Date', params: ['dateFrom', 'dateTo'] },
  ];
  for (const { column, params } of legacyGroups) {
    it(`preserves ${column} criteria only when that filter is available`, () => {
      const effective = effectiveSearchFilters(decodeFilters(url), [{ key: column, label: column }]);
      assert.deepEqual([...encodeFilters(effective).keys()].sort(), [...params].sort());
      assert.ok(landSaleFilterClauses(effective).every(clause => clause.column === (column === 'Proposed Use' ? 'proposed_use_labels' : column)));
    });
  }

  it('ignores hidden relative dates, supports all filters hidden, and tolerates malformed links', () => {
    const relative = decodeFilters(new URLSearchParams('lastDuration=6&lastUnit=months&ff=Sale%20Date|date|2024-01-01:'));
    const none = effectiveSearchFilters(relative, []);
    assert.equal(hasAnyFilter(none), false);
    assert.deepEqual(landSaleFilterClauses(none), []);
    const all = effectiveSearchFilters(decodeFilters(url), []);
    assert.equal(hasAnyFilter(all), false);
    assert.deepEqual(landSaleFilterClauses(all), []);
    assert.doesNotThrow(() => effectiveSearchFilters(decodeFilters({ ff: ['unknown|text|x', 'broken'], sfMin: 'nan' }), []));
  });
});

describe('saving search filters', () => {
  const columns = resultColumns();
  const hiddenFields = new Set(['Zoning']);

  it('rejects unknown, nontext, duplicate, and hidden-column selections', () => {
    for (const ids of [['unknown'], ['Zoning'], ['Market', 'Market'], [new File(['x'], 'x.txt')]]) {
      assert.equal(validateSearchFilterSelection(ids, columns, hiddenFields, new Set()).ok, false);
    }
  });

  it('allows hiding every filter and preserves a temporarily hidden column preference', () => {
    const saved = validateSearchFilterSelection([], columns, hiddenFields, new Set(['Zoning']));
    assert.ok(saved.ok);
    assert.equal(saved.hiddenFilterIds.length, columns.length);
    const visible = columns.filter(column => !hiddenFields.has(column.key)).map(column => column.key);
    const shown = validateSearchFilterSelection(visible, columns, hiddenFields, new Set(['Zoning', 'Market']));
    assert.deepEqual(shown, { ok: true, hiddenFilterIds: ['Zoning'] });
    const restored = searchFilterColumns(columns, new Set(), new Set(shown.ok ? shown.hiddenFilterIds : []));
    assert.equal(restored.some(column => column.key === 'Zoning'), false);
    assert.equal(restored.some(column => column.key === 'Market'), true);
  });
});
