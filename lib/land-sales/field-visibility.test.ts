import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecordDisplayPages,
  buildRecordDisplaySheets,
  fieldDisplayRows,
  fieldVisibilityId,
  filterVisibleColumns,
  filterVisibleDetailSheets,
  orderColumns,
  validateFieldOrder,
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

describe('record display pages', () => {
  const columns = resultColumns();
  const dividers = [
    { id: 'txn', kind: 'page' as const, label: 'Transaction' },
    { id: 'site', kind: 'group' as const, label: 'Site' },
    { id: 'money', kind: 'group' as const, label: 'Pricing' },
  ];
  /** Hides everything but the fields a case names, so the assertions stay short. */
  const hiddenExceptFor = (ids: string[]) => new Set(
    columns.map(fieldVisibilityId).filter(id => !ids.includes(id)),
  );
  const field = (key: string) => ({
    kind: 'field' as const,
    column: { kind: 'extra' as const, key, label: key },
  });

  it('puts every field on one untitled page when nothing is arranged', () => {
    const pages = buildRecordDisplayPages(
      fieldDisplayRows(columns, []),
      hiddenExceptFor(['extra:Property Address', 'extra:Zoning']),
    );

    assert.equal(pages.length, 1);
    assert.equal(pages[0].title, null);
    assert.deepEqual(pages[0].items, [field('Property Address'), field('Zoning')]);
  });

  it('opens a titled page at each page divider', () => {
    const rows = fieldDisplayRows(columns, [
      'extra:Property Address',
      'page:txn',
      'extra:Sale Price',
    ], dividers);
    const pages = buildRecordDisplayPages(
      rows,
      hiddenExceptFor(['extra:Property Address', 'extra:Sale Price']),
    );

    assert.deepEqual(pages.map(page => page.title), [null, 'Transaction']);
    assert.deepEqual(pages[0].items, [field('Property Address')]);
    assert.deepEqual(pages[1].items, [field('Sale Price')]);
  });

  it('titles a section inside the page a group sits on', () => {
    const rows = fieldDisplayRows(columns, [
      'page:txn',
      'group:money',
      'extra:Sale Price',
    ], dividers);
    const pages = buildRecordDisplayPages(rows, hiddenExceptFor(['extra:Sale Price']));

    assert.deepEqual(pages.map(page => page.title), ['Transaction']);
    assert.deepEqual(pages[0].items, [
      { kind: 'group', id: 'money', label: 'Pricing' },
      field('Sale Price'),
    ]);
  });

  it('closes an open group at a page break', () => {
    const rows = fieldDisplayRows(columns, [
      'group:site',
      'extra:Zoning',
      'page:txn',
      'extra:Sale Price',
    ], dividers);
    const pages = buildRecordDisplayPages(
      rows,
      hiddenExceptFor(['extra:Zoning', 'extra:Sale Price']),
    );

    assert.deepEqual(pages[0].items, [
      { kind: 'group', id: 'site', label: 'Site' },
      field('Zoning'),
    ]);
    assert.deepEqual(pages[1].items, [field('Sale Price')]);
  });

  it('drops a page whose fields are all hidden', () => {
    const rows = fieldDisplayRows(columns, [
      'extra:Zoning',
      'page:txn',
      'extra:Sale Price',
    ], dividers);
    const pages = buildRecordDisplayPages(rows, hiddenExceptFor(['extra:Zoning']));

    assert.deepEqual(pages.map(page => page.title), [null]);
  });

  it('drops a group whose fields are all hidden', () => {
    const rows = fieldDisplayRows(columns, [
      'extra:Zoning',
      'group:money',
      'extra:Sale Price',
    ], dividers);
    const pages = buildRecordDisplayPages(rows, hiddenExceptFor(['extra:Zoning']));

    assert.deepEqual(pages[0].items, [field('Zoning')]);
  });

  it('drops a divider token the saved dividers no longer describe', () => {
    const rows = fieldDisplayRows(columns, ['page:retired', 'extra:Zoning'], dividers);
    assert.deepEqual(rows[0], {
      kind: 'column',
      id: 'extra:Zoning',
      column: { kind: 'extra', key: 'Zoning', label: 'Zoning' },
    });
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

describe('orderColumns', () => {
  const columns = resultColumns();
  const catalogIds = columns.map(fieldVisibilityId);

  it('keeps the catalog order when nothing has been arranged', () => {
    assert.deepEqual(orderColumns(columns, []).map(fieldVisibilityId), catalogIds);
  });

  it('follows the saved arrangement', () => {
    const arranged = ['extra:Zoning', 'extra:Property City', 'extra:Property Address'];
    assert.deepEqual(
      orderColumns(columns, [...arranged, ...catalogIds.filter(id => !arranged.includes(id))])
        .map(fieldVisibilityId)
        .slice(0, 3),
      arranged,
    );
  });

  it('appends fields the saved arrangement never mentioned, in catalog order', () => {
    const ordered = orderColumns(columns, ['extra:Zoning', 'extra:Market']).map(fieldVisibilityId);
    assert.deepEqual(ordered.slice(0, 2), ['extra:Zoning', 'extra:Market']);
    assert.deepEqual(
      ordered.slice(2),
      catalogIds.filter(id => !['extra:Zoning', 'extra:Market'].includes(id)),
    );
  });

  it('ignores identifiers that are no longer columns', () => {
    assert.deepEqual(
      orderColumns(columns, ['extra:Retired Field', 'extra:Zoning']).map(fieldVisibilityId),
      ['extra:Zoning', ...catalogIds.filter(id => id !== 'extra:Zoning')],
    );
  });
});

describe('validateFieldOrder', () => {
  const columns = resultColumns();
  const catalogIds = columns.map(fieldVisibilityId);

  it('stores the catalog order when the submission carries none', () => {
    assert.deepEqual(validateFieldOrder([], columns), { ok: true, fieldOrder: catalogIds });
  });

  it('completes a partial order with the fields it left out', () => {
    const result = validateFieldOrder(['extra:Zoning'], columns);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(
      result.fieldOrder,
      ['extra:Zoning', ...catalogIds.filter(id => id !== 'extra:Zoning')],
    );
  });

  it('rejects duplicate identifiers', () => {
    assert.deepEqual(
      validateFieldOrder(['extra:Zoning', 'extra:Zoning'], columns),
      { ok: false, message: 'The field order contains a duplicate field.' },
    );
  });

  it('rejects unknown identifiers', () => {
    assert.deepEqual(
      validateFieldOrder(['core:city'], columns),
      { ok: false, message: 'The field order contains an unknown field.' },
    );
  });
});

describe('validateFieldOrder with dividers', () => {
  const columns = resultColumns();
  const dividers = [{ id: 'txn', kind: 'page' as const, label: 'Transaction' }];

  it('accepts a divider token the submission describes', () => {
    const result = validateFieldOrder(['page:txn', 'extra:Zoning'], columns, dividers);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.fieldOrder.slice(0, 2), ['page:txn', 'extra:Zoning']);
  });

  it('rejects a divider token nothing describes', () => {
    assert.deepEqual(
      validateFieldOrder(['page:txn', 'extra:Zoning'], columns),
      { ok: false, message: 'The field order contains an unknown page or field group.' },
    );
  });
});
