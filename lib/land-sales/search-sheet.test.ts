import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compactDraftFilters } from './field-filters.ts';
import type { RecordDisplayPage } from './field-visibility.ts';
import { emptyFilters } from './search-params.ts';
import {
  draftsFromSearchFilters,
  emptySearchSuggestionDependencies,
  filterSuggestionOptions,
  filtersFromSearchSheet,
  indexDependentValues,
  isSearchSuggestionColumn,
  reconcileDependentDrafts,
  searchControlHint,
  searchSheetColumns,
  suggestionOptionsForColumn,
} from './search-sheet.ts';

const pages: RecordDisplayPage[] = [
  {
    id: 'lead',
    title: null,
    items: [{ kind: 'field', column: { key: 'Property Name', label: 'Property Name' } }],
  },
  {
    id: 'property',
    title: 'Property Details',
    items: [
      { kind: 'group', id: 'loc', label: 'Location' },
      { kind: 'field', column: { key: 'Property State', label: 'Property State' } },
      { kind: 'field', column: { key: 'Land Area SF', label: 'Land Area SF' } },
      { kind: 'field', column: { key: 'Sale Date', label: 'Sale Date' } },
    ],
  },
];

describe('searchSheetColumns', () => {
  it('lists arranged fields in order and skips groups', () => {
    assert.deepEqual(searchSheetColumns(pages), [
      'Property Name',
      'Property State',
      'Land Area SF',
      'Sale Date',
    ]);
  });
});

describe('draftsFromSearchFilters', () => {
  it('starts blank when there are no filters', () => {
    const drafts = draftsFromSearchFilters(emptyFilters, searchSheetColumns(pages));
    assert.equal(drafts.every(d => {
      switch (d.kind) {
        case 'text': return d.contains === '';
        case 'number': return d.min === '' && d.max === '';
        case 'date': return d.from === '' && d.to === '';
        case 'boolean': return d.value === '';
        default: return false;
      }
    }), true);
  });

  it('prefers fieldFilters over primary overlays', () => {
    const drafts = draftsFromSearchFilters({
      ...emptyFilters,
      state: 'NY',
      fieldFilters: [{ column: 'Property State', kind: 'text', contains: 'NC' }],
    }, ['Property State']);
    assert.deepEqual(drafts[0], { column: 'Property State', kind: 'text', contains: 'NC' });
  });

  it('overlays legacy primary params onto empty drafts', () => {
    const drafts = draftsFromSearchFilters({
      ...emptyFilters,
      state: 'NC',
      market: 'Raleigh',
      sfMin: 1000,
      sfMax: 5000,
      time: { mode: 'range', from: '2024-01-01', to: '2024-12-31' },
    }, ['Property State', 'Market', 'Land Area SF', 'Sale Date']);
    assert.deepEqual(drafts.find(d => d.column === 'Property State'), {
      column: 'Property State', kind: 'text', contains: 'NC',
    });
    assert.deepEqual(drafts.find(d => d.column === 'Market'), {
      column: 'Market', kind: 'text', contains: 'Raleigh',
    });
    assert.deepEqual(drafts.find(d => d.column === 'Land Area SF'), {
      column: 'Land Area SF', kind: 'number', min: '1000', max: '5000',
    });
    assert.deepEqual(drafts.find(d => d.column === 'Sale Date'), {
      column: 'Sale Date', kind: 'date', from: '2024-01-01', to: '2024-12-31',
    });
  });
});

describe('filtersFromSearchSheet', () => {
  it('emits only compacted field filters', () => {
    const drafts = draftsFromSearchFilters({
      ...emptyFilters,
      state: 'NC',
      sfMin: 10,
    }, ['Property State', 'Land Area SF']);
    const next = filtersFromSearchSheet(compactDraftFilters(drafts));
    assert.deepEqual(next, {
      types: [],
      proposedUses: [],
      fieldFilters: [
        { column: 'Property State', kind: 'text', contains: 'NC' },
        { column: 'Land Area SF', kind: 'number', min: 10 },
      ],
    });
  });
});

describe('searchControlHint', () => {
  it('names the operator by column type', () => {
    assert.equal(searchControlHint('Property City'), 'Contains');
    assert.equal(searchControlHint('Sale Price'), 'Min / max');
    assert.equal(searchControlHint('Sale Date'), 'From / to');
  });
});

describe('search suggestion columns', () => {
  it('recognizes the combobox fields', () => {
    assert.equal(isSearchSuggestionColumn('Property City'), true);
    assert.equal(isSearchSuggestionColumn('Sale Status'), true);
    assert.equal(isSearchSuggestionColumn('Property Name'), false);
  });

  it('filters options without requiring an exact match', () => {
    assert.deepEqual(
      filterSuggestionOptions(['Raleigh', 'Charlotte', 'Asheville'], 'char'),
      ['Charlotte'],
    );
    assert.deepEqual(
      filterSuggestionOptions(['Raleigh', 'Charlotte'], '   '),
      ['Raleigh', 'Charlotte'],
    );
  });
});

describe('suggestion field dependencies', () => {
  const suggestions = {
    'Property City': ['Garner', 'Raleigh', 'Charlotte'],
    'Property County': ['Wake', 'Mecklenburg', 'Durham'],
    Market: ['Raleigh, NC', 'Charlotte, NC'],
    'Submarket Name': ['Wake County', 'Mecklenburg County'],
    'Secondary Type': ['Agricultural', 'Commercial', 'Industrial', 'Residential'],
    'Proposed Use': ['Retail', 'Office', 'Industrial'],
  };
  const dependencies = {
    ...emptySearchSuggestionDependencies,
    citiesByState: indexDependentValues([
      { parent: 'NC', child: 'Garner' },
      { parent: 'NC', child: 'Raleigh' },
      { parent: 'SC', child: 'Charlotte' },
    ]),
    countiesByState: indexDependentValues([
      { parent: 'NC', child: 'Wake' },
      { parent: 'NC', child: 'Durham' },
      { parent: 'SC', child: 'Mecklenburg' },
    ]),
    marketsByState: indexDependentValues([
      { parent: 'NC', child: 'Raleigh, NC' },
      { parent: 'SC', child: 'Charlotte, NC' },
    ]),
    submarketsByMarket: indexDependentValues([
      { parent: 'Raleigh, NC', child: 'Wake County' },
      { parent: 'Charlotte, NC', child: 'Mecklenburg County' },
    ]),
    secondaryTypesByPropertyType: indexDependentValues([
      { parent: 'Land (Neighborhood Center)', child: 'Commercial' },
      { parent: 'Land', child: 'Residential' },
      { parent: 'Land', child: 'Agricultural' },
    ]),
    proposedUsesByPropertyType: indexDependentValues([
      { parent: 'Land (Neighborhood Center)', child: 'Retail' },
      { parent: 'Land', child: 'Industrial' },
    ]),
  };

  it('scopes City and County to State, Market to State, and Submarket to Market', () => {
    assert.deepEqual(
      suggestionOptionsForColumn('Property City', suggestions, dependencies, {
        state: 'NC', market: '', propertyType: '',
      }),
      ['Garner', 'Raleigh'],
    );
    assert.deepEqual(
      suggestionOptionsForColumn('Property County', suggestions, dependencies, {
        state: 'NC', market: '', propertyType: '',
      }),
      ['Durham', 'Wake'],
    );
    assert.deepEqual(
      suggestionOptionsForColumn('Market', suggestions, dependencies, {
        state: 'NC', market: '', propertyType: '',
      }),
      ['Raleigh, NC'],
    );
    assert.deepEqual(
      suggestionOptionsForColumn('Submarket Name', suggestions, dependencies, {
        state: 'NC', market: 'Raleigh, NC', propertyType: '',
      }),
      ['Wake County'],
    );
  });

  it('scopes Secondary Type and Proposed Use to Property Type', () => {
    assert.deepEqual(
      suggestionOptionsForColumn('Secondary Type', suggestions, dependencies, {
        state: '', market: '', propertyType: 'Land (Neighborhood Center)',
      }),
      ['Commercial'],
    );
    assert.deepEqual(
      suggestionOptionsForColumn('Proposed Use', suggestions, dependencies, {
        state: '', market: '', propertyType: 'Land (Neighborhood Center)',
      }),
      ['Retail'],
    );
  });

  it('keeps the full child list when the parent is blank', () => {
    assert.deepEqual(
      suggestionOptionsForColumn('Property City', suggestions, dependencies, {
        state: '', market: '', propertyType: '',
      }),
      suggestions['Property City'],
    );
  });

  it('clears incompatible dependents when a parent changes', () => {
    const drafts = reconcileDependentDrafts(
      [
        { column: 'Property State', kind: 'text', contains: 'NC' },
        { column: 'Property City', kind: 'text', contains: 'Charlotte' },
        { column: 'Property County', kind: 'text', contains: 'Mecklenburg' },
        { column: 'Market', kind: 'text', contains: 'Charlotte, NC' },
        { column: 'Submarket Name', kind: 'text', contains: 'Mecklenburg County' },
        { column: 'Property Type', kind: 'text', contains: 'Land (Neighborhood Center)' },
        { column: 'Secondary Type', kind: 'text', contains: 'Residential' },
        { column: 'Proposed Use', kind: 'text', contains: 'Industrial' },
      ],
      suggestions,
      dependencies,
    );
    const text = (column: string) => {
      const draft = drafts.find(d => d.column === column);
      assert.ok(draft?.kind === 'text');
      return draft.contains;
    };
    assert.equal(text('Property City'), '');
    assert.equal(text('Property County'), '');
    assert.equal(text('Market'), '');
    assert.equal(text('Submarket Name'), '');
    assert.equal(text('Secondary Type'), '');
    assert.equal(text('Proposed Use'), '');
  });

  it('clears Submarket when it does not belong to the selected Market', () => {
    const drafts = reconcileDependentDrafts(
      [
        { column: 'Market', kind: 'text', contains: 'Raleigh, NC' },
        { column: 'Submarket Name', kind: 'text', contains: 'Mecklenburg County' },
      ],
      suggestions,
      dependencies,
    );
    const submarket = drafts.find(d => d.column === 'Submarket Name');
    assert.ok(submarket?.kind === 'text');
    assert.equal(submarket.contains, '');
  });

  it('keeps dependents that remain valid for their parents', () => {
    const drafts = reconcileDependentDrafts(
      [
        { column: 'Property State', kind: 'text', contains: 'NC' },
        { column: 'Property City', kind: 'text', contains: 'Raleigh' },
        { column: 'Property County', kind: 'text', contains: 'Wake' },
        { column: 'Market', kind: 'text', contains: 'Raleigh, NC' },
        { column: 'Submarket Name', kind: 'text', contains: 'Wake County' },
        { column: 'Property Type', kind: 'text', contains: 'Land (Neighborhood Center)' },
        { column: 'Secondary Type', kind: 'text', contains: 'Commercial' },
        { column: 'Proposed Use', kind: 'text', contains: 'Retail' },
      ],
      suggestions,
      dependencies,
    );
    const text = (column: string) => {
      const draft = drafts.find(d => d.column === column);
      assert.ok(draft?.kind === 'text');
      return draft.contains;
    };
    assert.equal(text('Property City'), 'Raleigh');
    assert.equal(text('Property County'), 'Wake');
    assert.equal(text('Market'), 'Raleigh, NC');
    assert.equal(text('Submarket Name'), 'Wake County');
    assert.equal(text('Secondary Type'), 'Commercial');
    assert.equal(text('Proposed Use'), 'Retail');
  });
});
