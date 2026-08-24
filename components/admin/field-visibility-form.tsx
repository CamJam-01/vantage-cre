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
  const cellLabelStyle = {
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
    height: '100%',
    padding: 'var(--space-2)',
    cursor: disabledReason ? 'not-allowed' : 'pointer',
  } as const;

  return (
    <form action={formAction}>
      <input type="hidden" name="database_key" value={databaseKey} />

      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Field</th>
              <th style={{ width: 120 }}>Display</th>
            </tr>
          </thead>
          <tbody>
            {columns.map(column => {
              const id = fieldVisibilityId(column);
              const visible = isVisible(column);
              const inputId = `display-${id}`;
              const disabled = Boolean(disabledReason) || pending;
              return (
                <tr
                  key={id}
                  style={visible ? undefined : {
                    background: 'var(--color-neutral-200)',
                    color: 'var(--color-neutral-600)',
                    opacity: 0.55,
                  }}
                >
                  <td style={{ padding: 0, height: 1 }}>
                    <label htmlFor={inputId} style={cellLabelStyle}>
                      {column.label}
                    </label>
                  </td>
                  <td style={{ padding: 0, height: 1 }}>
                    <label htmlFor={inputId} style={cellLabelStyle}>
                      <input
                        id={inputId}
                        type="checkbox"
                        name="visible_field_id"
                        value={id}
                        checked={visible}
                        disabled={disabled}
                        onChange={event => {
                          const checked = event.currentTarget.checked;
                          setOverrides(current => ({ ...current, [id]: checked }));
                        }}
                      />
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
