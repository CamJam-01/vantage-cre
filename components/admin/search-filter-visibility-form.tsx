'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import {
  saveSearchFilterVisibilityAction,
  type SearchFilterVisibilityActionState,
} from '@/app/(app)/admin/database-manager/fields/actions';
import type { DatabaseKey } from '@/lib/land-sales/field-visibility';
import type { ResultColumn } from '@/lib/land-sales/result-columns';

const initialState: SearchFilterVisibilityActionState = null;

export function SearchFilterVisibilityForm({
  databaseKey,
  columns,
  initialHiddenFilterIds,
  disabledReason,
}: {
  databaseKey: DatabaseKey;
  columns: ResultColumn[];
  initialHiddenFilterIds: string[];
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState(saveSearchFilterVisibilityAction, initialState);
  const hidden = state?.status === 'success' ? state.hiddenFilterIds : initialHiddenFilterIds;
  const message = disabledReason ?? state?.message;

  return (
    <form action={formAction}>
      <input type="hidden" name="database_key" value={databaseKey} />
      <fieldset
        key={JSON.stringify(hidden)}
        disabled={pending || Boolean(disabledReason)}
        style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
      >
        <legend style={{ marginBottom: 'var(--space-3)' }}>Displayed search filters</legend>
        <div style={{ display: 'grid', gap: 'var(--space-2)', maxHeight: 'calc(var(--space-8) * 12)', overflowY: 'auto' }}>
          {columns.map(column => (
            <label key={column.key} className="field-toggle" style={{ padding: 'var(--space-2)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="visible_filter_id"
                value={column.key}
                defaultChecked={!hidden.includes(column.key)}
              />
              <span className="field-toggle-track" aria-hidden>
                <span className="field-toggle-knob" />
              </span>
              <span>{column.label}</span>
            </label>
          ))}
        </div>
        {columns.length === 0 && <p>No results columns are displayed for this table.</p>}
        <Button variant="primary" type="submit" style={{ marginTop: 'var(--space-4)' }}>
          {pending ? 'Saving…' : 'Save Search Filters'}
        </Button>
      </fieldset>
      {message && (
        <p role="status" className={disabledReason || state?.status === 'error' ? 'record-error' : undefined}>
          {message}
        </p>
      )}
    </form>
  );
}
