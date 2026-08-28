import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecordDisplayPages,
  canonicalFieldId,
  fieldDisplayRows,
  fieldVisibilityId,
  filterVisibleColumns,
  orderColumns,
  validateFieldOrder,
  validateVisibleFieldIds,
  visibleField,
} from './field-visibility.ts';
import { resultColumns } from './result-columns.ts';

describe('field visibility identifiers', () => {
  it('uses the catalog header as the identifier', () => {
    assert.equal(fieldVisibilityId({ key: 'Property City', label: 'Property City' }), 'Property City');
  });

  it('strips a stored extra: prefix and drops prototype core: ids', () => {
    assert.equal(canonicalFieldId('extra:Zoning'), 'Zoning');
    assert.equal(canonicalFieldId('core:city'), null);
    assert.equal(canonicalFieldId('Property City'), 'Property City');
    assert.equal(canonicalFieldId('page:txn'), 'page:txn');
  });

  it('hides by header name', () => {
    const hidden = new Set(['Property City', 'Zoning']);
    assert.equal(visibleField('Property City', hidden), false);
    assert.equal(visibleField('Property County', hidden), true);
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
    const visible = filterVisibleColumns(columns, new Set(['Property Address', 'Zoning']));
    assert.equal(visible.some(column => column.key === 'Property Address'), false);
    assert.equal(visible.some(column => column.key === 'Zoning'), false);
    assert.equal(visible.some(column => column.key === 'Property City'), true);
  });
});

describe('record display pages', () => {
  const columns = resultColumns();
  const dividers = [
    { id: 'txn', kind: 'page' as const, label: 'Transaction' },
    { id: 'site', kind: 'group' as const, label: 'Site' },
    { id: 'money', kind: 'group' as const, label: 'Pricing' },
  ];
  const hiddenExceptFor = (ids: string[]) => new Set(
    columns.map(fieldVisibilityId).filter(id => !ids.includes(id)),
  );
  const field = (key: string) => ({
    kind: 'field' as const,
    column: { key, label: key },
  });

  it('puts every field on one untitled page when nothing is arranged', () => {
    const pages = buildRecordDisplayPages(
      fieldDisplayRows(columns, []),
      hiddenExceptFor(['Property Address', 'Zoning']),
    );

    assert.equal(pages.length, 1);
    assert.equal(pages[0].title, null);
    assert.deepEqual(pages[0].items, [field('Property Address'), field('Zoning')]);
  });

  it('opens a titled page at each page divider', () => {
    const rows = fieldDisplayRows(columns, [
      'Property Address',
      'page:txn',
      'Sale Price',
    ], dividers);
    const pages = buildRecordDisplayPages(
      rows,
      hiddenExceptFor(['Property Address', 'Sale Price']),
    );

    assert.deepEqual(pages.map(page => page.title), [null, 'Transaction']);
    assert.deepEqual(pages[0].items, [field('Property Address')]);
    assert.deepEqual(pages[1].items, [field('Sale Price')]);
  });

  it('titles a section inside the page a group sits on', () => {
    const rows = fieldDisplayRows(columns, [
      'page:txn',
      'group:money',
      'Sale Price',
    ], dividers);
    const pages = buildRecordDisplayPages(rows, hiddenExceptFor(['Sale Price']));

    assert.deepEqual(pages.map(page => page.title), ['Transaction']);
    assert.deepEqual(pages[0].items, [
      { kind: 'group', id: 'money', label: 'Pricing' },
      field('Sale Price'),
    ]);
  });

  it('closes an open group at a page break', () => {
    const rows = fieldDisplayRows(columns, [
      'group:site',
      'Zoning',
      'page:txn',
      'Sale Price',
    ], dividers);
    const pages = buildRecordDisplayPages(
      rows,
      hiddenExceptFor(['Zoning', 'Sale Price']),
    );

    assert.deepEqual(pages[0].items, [
      { kind: 'group', id: 'site', label: 'Site' },
      field('Zoning'),
    ]);
    assert.deepEqual(pages[1].items, [field('Sale Price')]);
  });

  it('drops a page whose fields are all hidden', () => {
    const rows = fieldDisplayRows(columns, [
      'Zoning',
      'page:txn',
      'Sale Price',
    ], dividers);
    const pages = buildRecordDisplayPages(rows, hiddenExceptFor(['Zoning']));

    assert.deepEqual(pages.map(page => page.title), [null]);
  });

  it('drops a group whose fields are all hidden', () => {
    const rows = fieldDisplayRows(columns, [
      'Zoning',
      'group:money',
      'Sale Price',
    ], dividers);
    const pages = buildRecordDisplayPages(rows, hiddenExceptFor(['Zoning']));

    assert.deepEqual(pages[0].items, [field('Zoning')]);
  });

  it('resolves a stored extra: prefix onto the catalog header', () => {
    const rows = fieldDisplayRows(columns, ['page:retired', 'extra:Zoning'], dividers);
    assert.deepEqual(rows[0], {
      kind: 'column',
      id: 'Zoning',
      column: { key: 'Zoning', label: 'Zoning' },
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
      validateVisibleFieldIds(['core:city', 'Property City'], columns),
      { ok: false, message: 'The field selection contains an unknown field.' },
    );
  });

  it('rejects duplicate identifiers, including extra: vs bare header', () => {
    assert.deepEqual(
      validateVisibleFieldIds(['Property City', 'extra:Property City'], columns),
      { ok: false, message: 'The field selection contains a duplicate field.' },
    );
  });

  it('derives the normalized hidden set from authoritative columns', () => {
    const result = validateVisibleFieldIds(['Property City', 'Zoning'], columns);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.hiddenFieldIds.includes('Property City'), false);
    assert.equal(result.hiddenFieldIds.includes('Zoning'), false);
    assert.equal(result.hiddenFieldIds.includes('Property Address'), true);
    assert.deepEqual(
      result.hiddenFieldIds,
      columns.map(fieldVisibilityId).filter(id => !['Property City', 'Zoning'].includes(id)),
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
    const arranged = ['Zoning', 'Property City', 'Property Address'];
    assert.deepEqual(
      orderColumns(columns, [...arranged, ...catalogIds.filter(id => !arranged.includes(id))])
        .map(fieldVisibilityId)
        .slice(0, 3),
      arranged,
    );
  });

  it('appends fields the saved arrangement never mentioned, in catalog order', () => {
    const ordered = orderColumns(columns, ['Zoning', 'Market']).map(fieldVisibilityId);
    assert.deepEqual(ordered.slice(0, 2), ['Zoning', 'Market']);
    assert.deepEqual(
      ordered.slice(2),
      catalogIds.filter(id => !['Zoning', 'Market'].includes(id)),
    );
  });

  it('ignores identifiers that are no longer columns', () => {
    assert.deepEqual(
      orderColumns(columns, ['Retired Field', 'Zoning']).map(fieldVisibilityId),
      ['Zoning', ...catalogIds.filter(id => id !== 'Zoning')],
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
    const result = validateFieldOrder(['Zoning'], columns);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(
      result.fieldOrder,
      ['Zoning', ...catalogIds.filter(id => id !== 'Zoning')],
    );
  });

  it('rejects duplicate identifiers', () => {
    assert.deepEqual(
      validateFieldOrder(['Zoning', 'Zoning'], columns),
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
    const result = validateFieldOrder(['page:txn', 'Zoning'], columns, dividers);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.fieldOrder.slice(0, 2), ['page:txn', 'Zoning']);
  });

  it('rejects a divider token nothing describes', () => {
    assert.deepEqual(
      validateFieldOrder(['page:txn', 'Zoning'], columns),
      { ok: false, message: 'The field order contains an unknown page or field group.' },
    );
  });
});
