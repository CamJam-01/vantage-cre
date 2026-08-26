'use client';

import { useActionState, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { GripVertical, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { ResultColumn } from '@/lib/land-sales/result-columns';
import {
  DEFAULT_FIELD_DIVIDER_LABELS,
  FIELD_DIVIDER_LABEL_MAX_LENGTH,
  fieldDisplayRows,
  fieldDividerOrderId,
  fieldVisibilityId,
  type DatabaseKey,
  type FieldDivider,
  type FieldDividerKind,
} from '@/lib/land-sales/field-visibility';
import {
  saveFieldVisibilityAction,
  type FieldVisibilityActionState,
} from '@/app/(app)/admin/database-manager/schema/actions';

type FieldVisibilityFormProps = {
  databaseKey: DatabaseKey;
  columns: ResultColumn[];
  initialHiddenFieldIds: string[];
  initialFieldOrder: string[];
  initialFieldDividers: FieldDivider[];
  disabledReason?: string;
};

const initialState: FieldVisibilityActionState = null;

type VisibilityFilter = 'both' | 'displayed' | 'hidden';

const VISIBILITY_FILTER_OPTIONS: { label: string; value: VisibilityFilter }[] = [
  { label: 'Both', value: 'both' },
  { label: 'Displayed', value: 'displayed' },
  { label: 'Hidden', value: 'hidden' },
];

const DIVIDER_BUTTON_LABELS: Record<FieldDividerKind, string> = {
  page: 'New Page',
  group: 'New Group',
};

/** Moves `sourceId` into the slot `targetId` occupies, sliding the fields in
 * between the other way. */
function reorderIds(ids: string[], sourceId: string, targetId: string): string[] {
  const from = ids.indexOf(sourceId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, sourceId);
  return next;
}

export function FieldVisibilityForm({
  databaseKey,
  columns,
  initialHiddenFieldIds,
  initialFieldOrder,
  initialFieldDividers,
  disabledReason,
}: FieldVisibilityFormProps) {
  const [state, formAction, pending] = useActionState(saveFieldVisibilityAction, initialState);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const [dividersOverride, setDividersOverride] = useState<FieldDivider[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('both');
  const handleRefs = useRef(new Map<string, HTMLButtonElement>());

  const saved = state?.status === 'success'
    ? { hidden: state.hiddenFieldIds, order: state.fieldOrder, dividers: state.fieldDividers }
    : { hidden: initialHiddenFieldIds, order: initialFieldOrder, dividers: initialFieldDividers };
  const savedHidden = new Set(saved.hidden);
  const savedIds = fieldDisplayRows(columns, saved.order, saved.dividers).map(row => row.id);

  const dividers = dividersOverride ?? saved.dividers;
  const rows = fieldDisplayRows(columns, orderOverride ?? saved.order, dividers);
  const rowIds = rows.map(row => row.id);

  function isVisible(column: ResultColumn): boolean {
    const id = fieldVisibilityId(column);
    return overrides[id] ?? !savedHidden.has(id);
  }

  function matchesVisibilityFilter(row: (typeof rows)[number]): boolean {
    if (visibilityFilter === 'both') return true;
    if (row.kind === 'divider') return visibilityFilter === 'displayed';
    return visibilityFilter === 'displayed'
      ? isVisible(row.column)
      : !isVisible(row.column);
  }

  const filteredRows = rows.filter(matchesVisibilityFilter);
  const shownIds = new Set(filteredRows.map(row => row.id));

  function moveTo(sourceId: string, targetId: string) {
    setOrderOverride(reorderIds(rowIds, sourceId, targetId));
  }

  function moveBy(sourceId: string, offset: number) {
    const target = rowIds[rowIds.indexOf(sourceId) + offset];
    if (target) moveTo(sourceId, target);
  }

  /** A new divider takes the slot directly above the row its button belongs to,
   * so it titles that field and everything after it. */
  function addDividerBefore(targetId: string, kind: FieldDividerKind) {
    const divider: FieldDivider = {
      id: crypto.randomUUID(),
      kind,
      label: DEFAULT_FIELD_DIVIDER_LABELS[kind],
    };
    const orderId = fieldDividerOrderId(divider);
    const next = [...rowIds];
    next.splice(Math.max(rowIds.indexOf(targetId), 0), 0, orderId);
    setDividersOverride([...dividers, divider]);
    setOrderOverride(next);
    return orderId;
  }

  function renameDivider(dividerId: string, label: string) {
    setDividersOverride(dividers.map(
      divider => (divider.id === dividerId ? { ...divider, label } : divider),
    ));
  }

  function removeDivider(divider: FieldDivider) {
    const orderId = fieldDividerOrderId(divider);
    setDividersOverride(dividers.filter(entry => entry.id !== divider.id));
    setOrderOverride(rowIds.filter(id => id !== orderId));
  }

  const visibleCount = columns.filter(isVisible).length;
  const visibilityDirty = columns.some(column => {
    const id = fieldVisibilityId(column);
    return isVisible(column) !== !savedHidden.has(id);
  });
  const orderDirty = rowIds.length !== savedIds.length
    || rowIds.some((id, index) => id !== savedIds[index]);
  const savedDividerLabels = new Map(saved.dividers.map(divider => [divider.id, divider.label]));
  const dividersDirty = dividers.some(
    divider => savedDividerLabels.get(divider.id) !== divider.label,
  );
  const dirty = visibilityDirty || orderDirty || dividersDirty;
  const disabled = Boolean(disabledReason) || pending;
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
  const rowActionStyle = {
    flex: '0 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'var(--space-2)',
    padding: '2px 8px',
    border: '1px solid color-mix(in srgb, var(--color-accent-800) 22%, transparent)',
    borderRadius: 4,
    background: 'transparent',
    color: 'var(--color-accent-700)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
  } as const;

  return (
    <form action={formAction}>
      <input type="hidden" name="database_key" value={databaseKey} />
      {/* Order carries hidden fields, pages, and groups alike, so unchecking a
          field does not lose its place in the arrangement. */}
      {rowIds.map(id => (
        <input key={id} type="hidden" name="field_order_id" value={id} />
      ))}
      <input type="hidden" name="field_dividers" value={JSON.stringify(dividers)} />
      {/* The Show filter can take a field that is On off screen, and only the
          toggles still rendered submit a value. Stand in for the rest, or
          saving under a filter would turn off everything it is not showing. */}
      {rows.map(row => (
        row.kind === 'column' && isVisible(row.column) && !shownIds.has(row.id) ? (
          <input key={`on-${row.id}`} type="hidden" name="visible_field_id" value={row.id} />
        ) : null
      ))}

      <p style={{ fontSize: 13, color: 'var(--color-neutral-700)', margin: '0 0 var(--space-3)' }}>
        Drag a field by its handle to change the order, or focus a handle and press the up and down
        arrow keys. A page starts a new tab on the record screens and a field group titles a section
        within one; without any pages, every field sits on a single untabbed screen. Results, record
        details, editing, and manual entry all follow this arrangement.
      </p>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
          Show
        </span>
        <SegmentedControl
          name="visibility-filter"
          value={visibilityFilter}
          onChange={value => setVisibilityFilter(value as VisibilityFilter)}
          options={VISIBILITY_FILTER_OPTIONS}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th scope="col" aria-label="Reorder" style={{ width: 44 }} />
              <th scope="col">Field</th>
              <th scope="col" style={{ width: 120 }}>Display</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: 'var(--space-4)', color: 'var(--color-neutral-700)', fontSize: 13 }}>
                  {visibilityFilter === 'displayed'
                    ? 'No displayed fields.'
                    : 'No hidden fields.'}
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => {
              const id = row.id;
              const dragging = draggingId === id;
              const draggingIndex = draggingId ? rowIds.indexOf(draggingId) : -1;
              const dropEdge = dropTargetId === id && draggingId !== id
                ? (draggingIndex > index ? 'top' : 'bottom')
                : null;
              const isDivider = row.kind === 'divider';
              const label = isDivider ? row.divider.label : row.column.label;
              const visible = isDivider || isVisible(row.column);
              const inputId = `display-${id}`;
              return (
                <tr
                  key={id}
                  draggable={!disabled}
                  onDragStart={event => {
                    setDraggingId(id);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', id);
                  }}
                  onDragOver={event => {
                    if (!draggingId) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDropTargetId(id);
                  }}
                  onDrop={event => {
                    event.preventDefault();
                    const sourceId = draggingId ?? event.dataTransfer.getData('text/plain');
                    if (sourceId) moveTo(sourceId, id);
                    setDraggingId(null);
                    setDropTargetId(null);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDropTargetId(null);
                  }}
                  style={{
                    ...(row.kind === 'divider' ? {
                      background: row.divider.kind === 'page'
                        ? 'color-mix(in srgb, var(--color-accent-800) 16%, transparent)'
                        : 'color-mix(in srgb, var(--color-accent-800) 8%, transparent)',
                    } : undefined),
                    ...(visible ? undefined : {
                      background: 'var(--color-neutral-200)',
                      color: 'var(--color-neutral-600)',
                      opacity: 0.55,
                    }),
                    ...(dragging ? { opacity: 0.4 } : undefined),
                    ...(dropEdge ? {
                      boxShadow: dropEdge === 'top'
                        ? 'inset 0 2px 0 0 var(--color-accent-700)'
                        : 'inset 0 -2px 0 0 var(--color-accent-700)',
                    } : undefined),
                  }}
                >
                  <td style={{ padding: 0, height: 1 }}>
                    <button
                      ref={node => {
                        if (node) handleRefs.current.set(id, node);
                        else handleRefs.current.delete(id);
                      }}
                      type="button"
                      aria-label={`Reorder ${label}, position ${index + 1} of ${filteredRows.length}`}
                      disabled={disabled}
                      onKeyDown={event => {
                        const offset = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
                        if (!offset) return;
                        event.preventDefault();
                        // Reordering moves the row's DOM node, which drops
                        // focus; commit synchronously so the handle can be
                        // handed focus back and arrow keys keep working.
                        flushSync(() => moveBy(id, offset));
                        handleRefs.current.get(id)?.focus();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        padding: 'var(--space-2)',
                        border: 0,
                        background: 'none',
                        color: 'inherit',
                        cursor: disabled ? 'not-allowed' : 'grab',
                      }}
                    >
                      <GripVertical size={15} strokeWidth={2} aria-hidden />
                    </button>
                  </td>

                  {row.kind === 'divider' ? (
                    /* A page or group has nothing to show or hide, so it takes
                       the Display column too. */
                    <td colSpan={2} style={{ padding: 0, height: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-2)', gap: 'var(--space-2)' }}>
                        <span style={{
                          flex: '0 0 auto',
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: 'var(--color-accent-800)',
                        }}>
                          {row.divider.kind === 'page' ? 'Page' : 'Group'}
                        </span>
                        <input
                          className="input"
                          aria-label={`${row.divider.kind === 'page' ? 'Page' : 'Field group'} name, position ${index + 1}`}
                          value={row.divider.label}
                          maxLength={FIELD_DIVIDER_LABEL_MAX_LENGTH}
                          disabled={disabled}
                          placeholder={DEFAULT_FIELD_DIVIDER_LABELS[row.divider.kind]}
                          onChange={event => renameDivider(row.divider.id, event.currentTarget.value)}
                          style={{ flex: 1, minWidth: 0, fontWeight: 600 }}
                        />
                        <button
                          type="button"
                          disabled={disabled}
                          aria-label={`Remove ${row.divider.kind === 'page' ? 'page' : 'field group'} ${label}`}
                          onClick={() => removeDivider(row.divider)}
                          style={rowActionStyle}
                        >
                          <X size={12} strokeWidth={2.5} aria-hidden />
                          Remove
                        </button>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td style={{ padding: 0, height: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                          <label htmlFor={inputId} style={{ ...cellLabelStyle, flex: 1, minWidth: 0 }}>
                            {label}
                          </label>
                          {(['page', 'group'] as const).map(kind => (
                            <button
                              key={kind}
                              type="button"
                              disabled={disabled}
                              aria-label={`${DIVIDER_BUTTON_LABELS[kind]} above ${label}`}
                              onClick={() => {
                                const orderId = flushSync(() => addDividerBefore(id, kind));
                                handleRefs.current.get(orderId)?.focus();
                              }}
                              style={{
                                ...rowActionStyle,
                                marginRight: kind === 'group' ? 'var(--space-2)' : 0,
                              }}
                            >
                              <Plus size={12} strokeWidth={2.5} aria-hidden />
                              {DIVIDER_BUTTON_LABELS[kind]}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: 0, height: 1 }}>
                        {/* The Field cell's label already names this input, so
                            the slider and its On/Off text stay out of the
                            accessible name; the checked state carries it. */}
                        <label className="field-toggle" style={cellLabelStyle}>
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
                          <span className="field-toggle-track" aria-hidden>
                            <span className="field-toggle-knob" />
                          </span>
                          <span className="field-toggle-text" aria-hidden>
                            {visible ? 'On' : 'Off'}
                          </span>
                        </label>
                      </td>
                    </>
                  )}
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
          disabled={disabled || !dirty}
          onClick={() => {
            setOverrides({});
            setOrderOverride(null);
            setDividersOverride(null);
          }}
        >
          Reset
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || visibleCount === columns.length}
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
          disabled={disabled || !dirty || visibleCount === 0}
        >
          {pending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
