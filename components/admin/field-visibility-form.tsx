'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ResultColumn } from '@/lib/land-sales/result-columns';
import {
  fieldVisibilityId,
  type DatabaseKey,
} from '@/lib/land-sales/field-visibility';
import {
  saveFieldVisibilityAction,
  type FieldVisibilityActionState,
} from '@/app/(app)/admin/database-manager/schema/actions';

type FieldVisibilityFormProps = {
  databaseKey: DatabaseKey;
  columns: ResultColumn[];
  initialHiddenFieldIds: string[];
  disabledReason?: string;
};

const initialState: FieldVisibilityActionState = null;

export function FieldVisibilityForm({
  databaseKey,
  columns,
  initialHiddenFieldIds,
  disabledReason,
}: FieldVisibilityFormProps) {
  const [state, formAction, pending] = useActionState(saveFieldVisibilityAction, initialState);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const savedHidden = new Set(
    state?.status === 'success' ? state.hiddenFieldIds : initialHiddenFieldIds,
  );

  function isVisible(column: ResultColumn): boolean {
    const id = fieldVisibilityId(column);
    return overrides[id] ?? !savedHidden.has(id);
  }

  const visibleCount = columns.filter(isVisible).length;
  const dirty = columns.some(column => {
    const id = fieldVisibilityId(column);
    return isVisible(column) !== !savedHidden.has(id);
  });
  const message = disabledReason
    ?? (state?.status === 'error' ? state.message : state?.status === 'success' ? state.message : undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="database_key" value={databaseKey} />

      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Field</th>
              <th>Category</th>
              <th style={{ width: 120 }}>Visible</th>
            </tr>
          </thead>
          <tbody>
            {columns.map(column => {
              const id = fieldVisibilityId(column);
              const visible = isVisible(column);
              return (
                <tr key={id}>
                  <td>{column.label}</td>
                  <td>
                    <span className={`tag ${column.kind === 'core' ? 'tag-accent' : 'tag-neutral'}`}>
                      {column.kind === 'core' ? 'Core' : 'CoStar'}
                    </span>
                  </td>
                  <td>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: disabledReason ? 'not-allowed' : 'pointer' }}>
                      <input
                        type="checkbox"
                        name="visible_field_id"
                        value={id}
                        checked={visible}
                        disabled={Boolean(disabledReason) || pending}
                        onChange={event => {
                          const checked = event.currentTarget.checked;
                          setOverrides(current => ({ ...current, [id]: checked }));
                        }}
                        aria-label={`Show ${column.label}`}
                      />
                      <span>{visible ? 'Shown' : 'Hidden'}</span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visibleCount === 0 && !disabledReason ? (
        <p role="alert" style={{ margin: 'var(--space-3) 0 0', color: '#b3261e', fontSize: 13 }}>
          At least one field must remain visible.
        </p>
      ) : null}

      {message ? (
        <p
          aria-live="polite"
          style={{
            margin: 'var(--space-3) 0 0',
            color: state?.status === 'success' && !disabledReason ? 'var(--color-accent-700)' : '#b3261e',
            fontSize: 13,
          }}
        >
          {message}
        </p>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
        <Button
          type="button"
          variant="secondary"
          disabled={Boolean(disabledReason) || pending || visibleCount === columns.length}
          onClick={() => {
            const allVisible = Object.fromEntries(columns.map(column => [fieldVisibilityId(column), true]));
            setOverrides(allVisible);
          }}
        >
          Show All
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={Boolean(disabledReason) || pending || !dirty || visibleCount === 0}
        >
          {pending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
