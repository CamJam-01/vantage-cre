import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { costarColumnNames } from './costar-fields.ts';
import {
  COMP_NUMBER_MERGE_TAG,
  mergeTag,
  mergeTagCatalog,
  mergeTagName,
  mergeValue,
  mergeValuesFromColumns,
  mergeValuesForRecord,
} from './merge-tags.ts';

describe('mergeTagName', () => {
  it('slugs a catalog header into a tag name', () => {
    assert.equal(mergeTagName('Comp ID'), 'comp_id');
    assert.equal(mergeTagName('Property Name'), 'property_name');
    assert.equal(mergeTagName('Buyer (True) Company'), 'buyer_true_company');
    assert.equal(mergeTagName('All-Inclusive'), 'all_inclusive');
    assert.equal(mergeTagName('Density kW/rack'), 'density_kw_rack');
    assert.equal(mergeTagName('Typical Floor (SF)'), 'typical_floor_sf');
    assert.equal(mergeTagName('Parcel Number 1 (Min)'), 'parcel_number_1_min');
  });

  it('writes tags in the advertised braces-and-spaces form', () => {
    assert.equal(mergeTag('Comp ID'), '{{ comp_id }}');
  });
});

describe('mergeTagCatalog', () => {
  it('is derived from the closed catalog, in canonical order', () => {
    const catalog = mergeTagCatalog().filter(tag => tag.source === 'catalog');
    assert.deepEqual(catalog.map(tag => tag.header), costarColumnNames());
  });

  it('keeps every database-field descriptor inside the catalog', () => {
    const headers = new Set(costarColumnNames());
    const fieldTags = mergeTagCatalog().filter(tag => tag.source === 'catalog');
    assert.equal(fieldTags.every(tag => headers.has(tag.header)), true);
  });

  it('advertises comp_number as the sole merge-only tag', () => {
    const mergeOnly = mergeTagCatalog().filter(tag => tag.source === 'merge');
    assert.deepEqual(mergeOnly, [COMP_NUMBER_MERGE_TAG]);
    assert.equal(costarColumnNames().includes(COMP_NUMBER_MERGE_TAG.header), false);
  });

  it('gives every field and merge-only value a distinct tag', () => {
    const names = mergeTagCatalog().map(tag => tag.name);
    assert.equal(new Set(names).size, names.length);
    assert.equal(names.length, costarColumnNames().length + 1);
  });

  it('carries each column type from costarColumnType', () => {
    const byName = new Map(mergeTagCatalog().map(tag => [tag.name, tag.type]));
    assert.equal(byName.get('sale_date'), 'date');
    assert.equal(byName.get('sale_price'), 'number');
    assert.equal(byName.get('zoning'), 'text');
    assert.equal(byName.get('has_lab_space'), 'boolean');
  });
});

describe('mergeValue', () => {
  it('formats exactly as the results table renders the cell', () => {
    assert.equal(mergeValue('Sale Price', 1250000), '$1,250,000');
    assert.equal(mergeValue('Land Area SF', 12500), '12,500');
    assert.equal(mergeValue('Assessed Value', 2350950), '$2,350,950');
    assert.equal(mergeValue('Price Per SF Land', '10.2500'), '$10.2500');
    assert.equal(mergeValue('PropertyID', 9866427), '9866427');
    assert.equal(mergeValue('Buyer (True) Phone', '9195762500'), '(919) 576-2500');
    assert.equal(mergeValue('Sale Date', '2025-08-14T00:00:00'), '08/14/2025');
    assert.equal(mergeValue('Property City', 'Austin'), 'Austin');
    assert.equal(mergeValue('Has Lab Space', true), 'Yes');
    assert.equal(mergeValue('Has Lab Space', false), 'No');
  });

  it('merges a blank field as nothing at all — never the table’s em dash', () => {
    // The one deliberate divergence from formatCatalogValue: a tag in a
    // sentence has to disappear, where a table cell wants a visible placeholder.
    assert.equal(mergeValue('Sale Price', null), '');
    assert.equal(mergeValue('Sale Price', ''), '');
    assert.equal(mergeValue('Property City', undefined), '');
    assert.equal(mergeValue('Sale Date', null), '');
  });

  it('shows an unparseable value as stored rather than dropping it', () => {
    assert.equal(mergeValue('Sale Price', 'Undisclosed'), 'Undisclosed');
  });
});

describe('mergeValuesFromColumns', () => {
  const columns = {
    'Comp ID': 90210,
    'Property Name': 'Riverbend Tract',
    'Property City': 'Austin',
    'Sale Price': 1250000,
    'Land Area AC': 5,
    'Sale Date': '2025-08-14T00:00:00',
    'Buyer (True) Company': 'Acme Holdings',
  };

  it('keys merged text by tag name', () => {
    const values = mergeValuesFromColumns(columns);
    assert.equal(values.property_name, 'Riverbend Tract');
    assert.equal(values.sale_price, '$1,250,000');
    assert.equal(values.buyer_true_company, 'Acme Holdings');
  });

  it('supplies an entry for every catalog field, so an unset one blanks its tag', () => {
    const values = mergeValuesFromColumns(columns);
    for (const header of costarColumnNames()) {
      assert.equal(typeof values[mergeTagName(header)], 'string');
    }
    assert.equal(values.zoning, '');
  });

  it('ignores anything outside the catalog', () => {
    const values = mergeValuesFromColumns({ ...columns, id: 'uuid-here', _sale_date_raw: 'Aug 2025' });
    assert.equal('id' in values, false);
    assert.equal('_sale_date_raw' in values, false);
    assert.equal(COMP_NUMBER_MERGE_TAG.name in values, false);
  });
});

describe('mergeValuesForRecord', () => {
  it('adds the requested 1-based output sequence without changing field values', () => {
    const first = mergeValuesForRecord({ 'Property Name': 'Riverbend Tract' }, 1);
    const second = mergeValuesForRecord({ 'Property Name': 'Kestrel Flats' }, 2);

    assert.equal(first.comp_number, '1');
    assert.equal(second.comp_number, '2');
    assert.equal(first.property_name, 'Riverbend Tract');
    assert.equal(second.property_name, 'Kestrel Flats');
  });
});
