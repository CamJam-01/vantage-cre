import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resultColumns } from '../land-sales/result-columns.ts';
import { fieldVisibilityId } from '../land-sales/field-visibility.ts';
import { parseVisibilitySubmission } from './field-visibility-action.ts';

function formData(entries: Array<[string, string]>): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe('parseVisibilitySubmission', () => {
  const columns = resultColumns();

  it('accepts sales and derives hidden fields from repeated visible identifiers', () => {
    const result = parseVisibilitySubmission(formData([
      ['database_key', 'sales'],
      ['visible_field_id', 'Property City'],
      ['visible_field_id', 'Zoning'],
    ]), columns);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.databaseKey, 'sales');
    assert.deepEqual(
      result.hiddenFieldIds,
      columns.map(fieldVisibilityId).filter(id => !['Property City', 'Zoning'].includes(id)),
    );
  });

  it('rejects unavailable database keys', () => {
    assert.deepEqual(
      parseVisibilitySubmission(formData([
        ['database_key', 'rentals'],
        ['visible_field_id', 'Property City'],
      ]), columns),
      { ok: false, message: 'This database is not available for field visibility settings.' },
    );
  });

  it('rejects a submission that hides every field', () => {
    assert.deepEqual(
      parseVisibilitySubmission(formData([['database_key', 'sales']]), columns),
      { ok: false, message: 'At least one field must remain visible.' },
    );
  });

  it('rejects unknown field identifiers', () => {
    assert.deepEqual(
      parseVisibilitySubmission(formData([
        ['database_key', 'sales'],
        ['visible_field_id', 'core:unknown'],
      ]), columns),
      { ok: false, message: 'The field selection contains an unknown field.' },
    );
  });

  it('rejects duplicate field identifiers', () => {
    assert.deepEqual(
      parseVisibilitySubmission(formData([
        ['database_key', 'sales'],
        ['visible_field_id', 'Property City'],
        ['visible_field_id', 'Property City'],
      ]), columns),
      { ok: false, message: 'The field selection contains a duplicate field.' },
    );
  });

  it('keeps the submitted arrangement, hidden fields included', () => {
    const result = parseVisibilitySubmission(formData([
      ['database_key', 'sales'],
      ['visible_field_id', 'Zoning'],
      ['field_order_id', 'Zoning'],
      ['field_order_id', 'Property City'],
      ['field_order_id', 'Property Address'],
    ]), columns);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(
      result.fieldOrder.slice(0, 3),
      ['Zoning', 'Property City', 'Property Address'],
    );
    assert.equal(result.fieldOrder.length, columns.length);
  });

  it('falls back to the catalog order when no arrangement is submitted', () => {
    const result = parseVisibilitySubmission(formData([
      ['database_key', 'sales'],
      ['visible_field_id', 'Zoning'],
    ]), columns);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.fieldOrder, columns.map(fieldVisibilityId));
  });

  it('rejects an arrangement naming a field twice', () => {
    assert.deepEqual(
      parseVisibilitySubmission(formData([
        ['database_key', 'sales'],
        ['visible_field_id', 'Zoning'],
        ['field_order_id', 'Zoning'],
        ['field_order_id', 'Zoning'],
      ]), columns),
      { ok: false, message: 'The field order contains a duplicate field.' },
    );
  });

  it('rejects an arrangement naming an unknown field', () => {
    assert.deepEqual(
      parseVisibilitySubmission(formData([
        ['database_key', 'sales'],
        ['visible_field_id', 'Zoning'],
        ['field_order_id', 'core:city'],
      ]), columns),
      { ok: false, message: 'The field order contains an unknown field.' },
    );
  });
});

describe('parseVisibilitySubmission dividers', () => {
  const columns = resultColumns();

  it('keeps dividers the arrangement places, in the order submitted', () => {
    const result = parseVisibilitySubmission(formData([
      ['database_key', 'sales'],
      ['visible_field_id', 'Zoning'],
      ['field_dividers', JSON.stringify([{ id: 'site', kind: 'group', label: 'Site' }])],
      ['field_order_id', 'group:site'],
      ['field_order_id', 'Zoning'],
    ]), columns);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.fieldDividers, [{ id: 'site', kind: 'group', label: 'Site' }]);
    assert.deepEqual(result.fieldOrder.slice(0, 2), ['group:site', 'Zoning']);
  });

  it('names a divider left blank so it still titles a section', () => {
    const result = parseVisibilitySubmission(formData([
      ['database_key', 'sales'],
      ['visible_field_id', 'Zoning'],
      ['field_dividers', JSON.stringify([{ id: 'site', kind: 'group', label: '   ' }])],
      ['field_order_id', 'group:site'],
      ['field_order_id', 'Zoning'],
    ]), columns);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.fieldDividers, [{ id: 'site', kind: 'group', label: 'Field Group' }]);
  });

  it('discards a divider the arrangement never places', () => {
    const result = parseVisibilitySubmission(formData([
      ['database_key', 'sales'],
      ['visible_field_id', 'Zoning'],
      ['field_dividers', JSON.stringify([{ id: 'orphan', kind: 'group', label: 'Orphan' }])],
      ['field_order_id', 'Zoning'],
    ]), columns);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.fieldDividers, []);
  });

  it('rejects an order placing a divider that was not submitted', () => {
    assert.deepEqual(
      parseVisibilitySubmission(formData([
        ['database_key', 'sales'],
        ['visible_field_id', 'Zoning'],
        ['field_order_id', 'group:site'],
        ['field_order_id', 'Zoning'],
      ]), columns),
      { ok: false, message: 'The field order contains an unknown page or field group.' },
    );
  });

  it('rejects dividers that are not readable JSON', () => {
    assert.deepEqual(
      parseVisibilitySubmission(formData([
        ['database_key', 'sales'],
        ['visible_field_id', 'Zoning'],
        ['field_dividers', '{oops'],
      ]), columns),
      { ok: false, message: 'The pages and field groups could not be read.' },
    );
  });

  it('rejects the same divider listed twice', () => {
    assert.deepEqual(
      parseVisibilitySubmission(formData([
        ['database_key', 'sales'],
        ['visible_field_id', 'Zoning'],
        ['field_dividers', JSON.stringify([{ id: 'site', kind: 'group', label: 'Site' }, { id: 'site', kind: 'group', label: 'Site' }])],
      ]), columns),
      { ok: false, message: 'A page or field group is listed twice.' },
    );
  });
});
