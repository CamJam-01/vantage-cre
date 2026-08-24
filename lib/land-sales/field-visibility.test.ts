import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecordDisplaySheets,
  fieldVisibilityId,
  filterVisibleColumns,
  filterVisibleDetailSheets,
  validateVisibleFieldIds,
  visibleCoreField,
  visibleExtraField,
} from './field-visibility.ts';
import { DETAIL_SHEETS, resultColumns } from './result-columns.ts';

describe('field visibility identifiers', () => {
  it('namespaces core and custom fields so labels cannot collide', () => {
    assert.equal(fieldVisibilityId({ kind: 'core', key: 'city', label: 'City' }), 'core:city');
    assert.equal(fieldVisibilityId({ kind: 'extra', key: 'city', label: 'city' }), 'extra:city');
  });

  it('tests core and custom visibility with the same identifier convention', () => {
    const hidden = new Set(['core:city', 'extra:Zoning']);
    assert.equal(visibleCoreField('city', hidden), false);
    assert.equal(visibleCoreField('county', hidden), true);
    assert.equal(visibleExtraField('Zoning', hidden), false);
    assert.equal(visibleExtraField('Market', hidden), true);
  });
});

describe('field visibility filtering', () => {
  const columns = resultColumns();

  it('shows everything when the hidden set is empty', () => {
    assert.deepEqual(
      filterVisibleColumns(columns, new Set()).map(fieldVisibilityId),
      columns.map(fieldVisibilityId),
    );
  });

  it('removes hidden CoStar columns', () => {
    const visible = filterVisibleColumns(columns, new Set(['extra:Property Address', 'extra:Zoning']));
    assert.equal(visible.some(column => fieldVisibilityId(column) === 'extra:Property Address'), false);
    assert.equal(visible.some(column => fieldVisibilityId(column) === 'extra:Zoning'), false);
    assert.equal(visible.some(column => fieldVisibilityId(column) === 'extra:Property City'), true);
  });

  it('drops empty sections and sheets from record details', () => {
    const allButBuyer = new Set(['core:parcel_id', 'core:address', 'core:city', 'core:county', 'core:state', 'core:msa', 'core:property_type', 'core:sale_date', 'core:acreage', 'core:square_feet', 'core:sale_price', 'core:price_per_acre']);
    const sheets = filterVisibleDetailSheets(DETAIL_SHEETS, allButBuyer);
    assert.deepEqual(sheets.map(sheet => sheet.id), ['transaction']);
    assert.deepEqual(sheets[0].sections.flatMap(section => section.fields.map(field => field.key)), ['buyer']);
  });

  it('puts CoStar columns on the Additional Fields sheet when no core columns are listed', () => {
    const sheets = buildRecordDisplaySheets(DETAIL_SHEETS, columns, new Set());
    assert.deepEqual(sheets.map(sheet => sheet.id), ['additional']);
    assert.equal(sheets[0].extraColumns.length, columns.length);
    assert.equal(sheets[0].extraColumns[0]?.key, 'Property Address');
  });

  it('hides core drafting sheets when those fields are not in the column list', () => {
    const hiddenCore = new Set(columns.filter(column => column.kind === 'core').map(fieldVisibilityId));
    const sheets = buildRecordDisplaySheets(DETAIL_SHEETS, columns, hiddenCore);
    assert.deepEqual(sheets.map(sheet => sheet.id), ['additional']);
    assert.equal(sheets[0].extraColumns.some(column => column.key === 'Zoning'), true);
  });
});

describe('visible-field validation', () => {
  const columns = resultColumns();

  it('rejects an empty selection', () => {
    assert.deepEqual(
      validateVisibleFieldIds([], columns),
      { ok: false, message: 'At least one field must remain visible.' },
    );
  });

  it('rejects unknown identifiers', () => {
    assert.deepEqual(
      validateVisibleFieldIds(['core:city', 'extra:Property City'], columns),
      { ok: false, message: 'The field selection contains an unknown field.' },
    );
  });

  it('rejects duplicate identifiers', () => {
    assert.deepEqual(
      validateVisibleFieldIds(['extra:Property City', 'extra:Property City'], columns),
      { ok: false, message: 'The field selection contains a duplicate field.' },
    );
  });

  it('derives the normalized hidden set from authoritative columns', () => {
    const result = validateVisibleFieldIds(['extra:Property City', 'extra:Zoning'], columns);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.hiddenFieldIds.includes('extra:Property City'), false);
    assert.equal(result.hiddenFieldIds.includes('extra:Zoning'), false);
    assert.equal(result.hiddenFieldIds.includes('extra:Property Address'), true);
    assert.deepEqual(
      result.hiddenFieldIds,
      columns.map(fieldVisibilityId).filter(id => !['extra:Property City', 'extra:Zoning'].includes(id)),
    );
  });
});
