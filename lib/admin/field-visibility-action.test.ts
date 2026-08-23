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
  const columns = resultColumns({ catalogLabels: ['Zoning'] });

  it('accepts sales and derives hidden fields from repeated visible identifiers', () => {
    const result = parseVisibilitySubmission(formData([
      ['database_key', 'sales'],
      ['visible_field_id', 'core:city'],
      ['visible_field_id', 'extra:Zoning'],
    ]), columns);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.databaseKey, 'sales');
    assert.deepEqual(
      result.hiddenFieldIds,
      columns.map(fieldVisibilityId).filter(id => !['core:city', 'extra:Zoning'].includes(id)),
    );
  });

  it('rejects unavailable database keys', () => {
    assert.deepEqual(
      parseVisibilitySubmission(formData([
        ['database_key', 'rentals'],
        ['visible_field_id', 'core:city'],
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
        ['visible_field_id', 'core:city'],
        ['visible_field_id', 'core:city'],
      ]), columns),
      { ok: false, message: 'The field selection contains a duplicate field.' },
    );
  });
});
