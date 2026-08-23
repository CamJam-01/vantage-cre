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
  const columns = resultColumns({ catalogLabels: ['Zoning'] });

  it('shows everything when the hidden set is empty', () => {
    assert.deepEqual(
      filterVisibleColumns(columns, new Set()).map(fieldVisibilityId),
      columns.map(fieldVisibilityId),
    );
  });

  it('removes hidden core and custom columns', () => {
    const visible = filterVisibleColumns(columns, new Set(['core:address', 'extra:Zoning']));
    assert.equal(visible.some(column => fieldVisibilityId(column) === 'core:address'), false);
    assert.equal(visible.some(column => fieldVisibilityId(column) === 'extra:Zoning'), false);
  });

  it('drops empty sections and sheets from record details', () => {
    const allButBuyer = new Set(columns.map(fieldVisibilityId).filter(id => id !== 'core:buyer'));
    const sheets = filterVisibleDetailSheets(DETAIL_SHEETS, allButBuyer);
    assert.deepEqual(sheets.map(sheet => sheet.id), ['transaction']);
    assert.deepEqual(sheets[0].sections.flatMap(section => section.fields.map(field => field.key)), ['buyer']);
  });

  it('appends custom fields to the last visible core sheet', () => {
    const sheets = buildRecordDisplaySheets(DETAIL_SHEETS, columns, new Set());
    assert.deepEqual(sheets.at(-1)?.extraColumns.map(column => column.key), ['Zoning']);
  });

  it('keeps a usable Additional Fields sheet for a custom-only configuration', () => {
    const hiddenCore = new Set(columns.filter(column => column.kind === 'core').map(fieldVisibilityId));
    const sheets = buildRecordDisplaySheets(DETAIL_SHEETS, columns, hiddenCore);
    assert.deepEqual(sheets.map(sheet => sheet.id), ['additional']);
    assert.deepEqual(sheets[0].extraColumns.map(column => column.key), ['Zoning']);
  });
});

describe('visible-field validation', () => {
  const columns = resultColumns({ catalogLabels: ['Zoning'] });

  it('rejects an empty selection', () => {
    assert.deepEqual(
      validateVisibleFieldIds([], columns),
      { ok: false, message: 'At least one field must remain visible.' },
    );
  });

  it('rejects unknown identifiers', () => {
    assert.deepEqual(
      validateVisibleFieldIds(['core:city', 'core:missing'], columns),
      { ok: false, message: 'The field selection contains an unknown field.' },
    );
  });

  it('rejects duplicate identifiers', () => {
    assert.deepEqual(
      validateVisibleFieldIds(['core:city', 'core:city'], columns),
      { ok: false, message: 'The field selection contains a duplicate field.' },
    );
  });

  it('derives the normalized hidden set from authoritative columns', () => {
    const result = validateVisibleFieldIds(['core:city', 'extra:Zoning'], columns);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.hiddenFieldIds.includes('core:city'), false);
    assert.equal(result.hiddenFieldIds.includes('extra:Zoning'), false);
    assert.equal(result.hiddenFieldIds.includes('core:address'), true);
    assert.deepEqual(result.hiddenFieldIds, columns.map(fieldVisibilityId).filter(id => !['core:city', 'extra:Zoning'].includes(id)));
  });
});
