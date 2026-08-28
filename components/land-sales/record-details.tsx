'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { deleteLandSale, updateLandSale, type CreateFormState } from '@/app/(app)/land-sales/actions';
import {
  columnInputValue,
  fieldInputId,
  flaggedSaleDateRaw,
  toInputString,
  type LandSale,
} from '@/lib/land-sales/schema';
import { resultColumns } from '@/lib/land-sales/result-columns';
import {
  buildRecordDisplayPages,
  fieldDisplayRows,
  visibleField,
  type FieldDivider,
} from '@/lib/land-sales/field-visibility';
import {
  CURRENT_ACTION_STATE,
  visibleActionState,
} from '@/lib/land-sales/visible-action-state';
import { costarColumnType } from '@/lib/land-sales/costar-column-types';

const initialState: CreateFormState = null;

function detailsHref(id: string, from?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  const qs = params.toString();
  return qs ? `/land-sales/${id}?${qs}` : `/land-sales/${id}`;
}

/** The Save/Cancel controls live in the sticky action bar, outside the form, so
 * the form needs a stable id for their `form=` association. */
const FORM_ID = 'record-form';

function OptionalForm({
  action,
  children,
}: {
  action?: (formData: FormData) => void;
  children: ReactNode;
}) {
  if (!action) return children;
  return <form id={FORM_ID} action={action}>{children}</form>;
}

export function RecordDetails({
  record,
  from,
  canEdit,
  canDelete = false,
  startEditing = false,
  hiddenFieldIds = [],
  fieldOrder = [],
  fieldDividers = [],
}: {
  record: LandSale;
  from?: string;
  canEdit: boolean;
  canDelete?: boolean;
  startEditing?: boolean;
  hiddenFieldIds?: string[];
  fieldOrder?: string[];
  fieldDividers?: FieldDivider[];
}) {
  if (!canEdit) {
    return (
      <RecordDetailsForm
        record={record}
        from={from}
        canEdit={false}
        canDelete={canDelete}
        hiddenFieldIds={hiddenFieldIds}
        fieldOrder={fieldOrder}
        fieldDividers={fieldDividers}
      />
    );
  }
  return (
    <RecordDetailsEditor
      key={record.id}
      record={record}
      from={from}
      startEditing={startEditing}
      canDelete={canDelete}
      hiddenFieldIds={hiddenFieldIds}
      fieldOrder={fieldOrder}
      fieldDividers={fieldDividers}
    />
  );
}

function RecordDetailsEditor({
  record,
  from,
  startEditing = false,
  canDelete,
  hiddenFieldIds,
  fieldOrder,
  fieldDividers,
}: {
  record: LandSale;
  from?: string;
  startEditing?: boolean;
  canDelete: boolean;
  hiddenFieldIds: string[];
  fieldOrder: string[];
  fieldDividers: FieldDivider[];
}) {
  const router = useRouter();
  const [resetKey, setResetKey] = useState(0);

  function handleCancel() {
    setResetKey(k => k + 1);
    router.replace(detailsHref(record.id, from));
  }

  return (
    <BoundRecordDetailsForm
      key={resetKey}
      record={record}
      from={from}
      startEditing={resetKey === 0 && startEditing}
      onCancel={handleCancel}
      canDelete={canDelete}
      hiddenFieldIds={hiddenFieldIds}
      fieldOrder={fieldOrder}
      fieldDividers={fieldDividers}
    />
  );
}

function BoundRecordDetailsForm({
  record,
  from,
  startEditing,
  onCancel,
  canDelete,
  hiddenFieldIds,
  fieldOrder,
  fieldDividers,
}: {
  record: LandSale;
  from?: string;
  startEditing: boolean;
  onCancel: () => void;
  canDelete: boolean;
  hiddenFieldIds: string[];
  fieldOrder: string[];
  fieldDividers: FieldDivider[];
}) {
  const [state, formAction, pending] = useActionState(updateLandSale.bind(null, record.id), initialState);
  return (
    <RecordDetailsForm
      record={record}
      from={from}
      canEdit
      canDelete={canDelete}
      startEditing={startEditing}
      state={state}
      formAction={formAction}
      pending={pending}
      onCancel={onCancel}
      hiddenFieldIds={hiddenFieldIds}
      fieldOrder={fieldOrder}
      fieldDividers={fieldDividers}
    />
  );
}

function FieldControl({
  header,
  record,
  editing,
}: {
  header: string;
  record: LandSale;
  editing: boolean;
}) {
  const id = fieldInputId(header);
  const kind = costarColumnType(header);
  if (!editing) {
    const flagged = header === 'Sale Date' ? flaggedSaleDateRaw(record) : undefined;
    return (
      <>
        <input
          className="input"
          readOnly
          tabIndex={-1}
          value={columnInputValue(record, header) || '—'}
        />
        {flagged && (
          <span className="record-flag" title={`Unrecognized date from import: "${flagged}". Flagged for review.`}>
            <TriangleAlert size={14} strokeWidth={1.5} />
            Unrecognized date from import
          </span>
        )}
      </>
    );
  }
  if (kind === 'boolean') {
    const current = record.columns[header];
    const selected = current === true ? 'Yes' : current === false ? 'No' : '';
    return (
      <select id={id} name={header} className="input" defaultValue={selected} style={{ cursor: 'pointer' }}>
        <option value=""></option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    );
  }
  return (
    <input
      id={id}
      name={header}
      type="text"
      className="input"
      defaultValue={columnInputValue(record, header)}
      inputMode={kind === 'number' ? 'decimal' : undefined}
    />
  );
}

export function RecordDetailsForm({
  record,
  from,
  canEdit,
  canDelete = false,
  startEditing = false,
  createMode = false,
  state = null,
  formAction,
  pending = false,
  onCancel,
  hiddenFieldIds = [],
  fieldOrder = [],
  fieldDividers = [],
}: {
  record: LandSale;
  from?: string;
  canEdit: boolean;
  canDelete?: boolean;
  startEditing?: boolean;
  createMode?: boolean;
  state?: CreateFormState;
  formAction?: (formData: FormData) => void;
  pending?: boolean;
  onCancel?: () => void;
  hiddenFieldIds?: string[];
  fieldOrder?: string[];
  fieldDividers?: FieldDivider[];
}) {
  const hidden = new Set(hiddenFieldIds);
  const rows = fieldDisplayRows(resultColumns(), fieldOrder, fieldDividers);
  const pages = buildRecordDisplayPages(rows, hidden);
  const tabbedPages = pages.filter(page => page.title !== null);
  const [editing, setEditing] = useState(canEdit && (startEditing || createMode));
  const [activePage, setActivePage] = useState(tabbedPages[0]?.id ?? '');
  const [actionBaseline, setActionBaseline] = useState<CreateFormState | typeof CURRENT_ACTION_STATE>(
    startEditing ? CURRENT_ACTION_STATE : state,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const displayState = visibleActionState(state, actionBaseline);
  const backToSearchHref = from ? `/land-sales?${from}` : '/land-sales';

  const address = visibleField('Property Address', hidden)
    ? toInputString(record.columns['Property Address'])
    : '';
  const city = visibleField('Property City', hidden)
    ? toInputString(record.columns['Property City'])
    : '';
  const stateName = visibleField('Property State', hidden)
    ? toInputString(record.columns['Property State'])
    : '';
  const county = visibleField('Property County', hidden)
    ? toInputString(record.columns['Property County'])
    : '';
  const location = [city, stateName].filter(Boolean).join(', ');
  const subtitle = [county ? `${county} County` : '', location]
    .filter(Boolean)
    .join(' · ');

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteLandSale(record.id);
    setDeleting(false);
    if (result?.error) {
      setDeleteError(result.error);
      return;
    }
  }

  return (
    <>
      <div className="record-bar">
        <Link href={backToSearchHref} className="record-bar-back">
          <ArrowLeft size={15} strokeWidth={1.5} />
          Land Sales
        </Link>
        <div className="record-bar-actions">
          {canDelete && !createMode && !editing && (
            <Button type="button" variant="secondary" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          {canEdit && (
            editing ? (
              <>
                {createMode ? (
                  <Link href="/land-sales" className="btn btn-secondary">
                    Cancel
                  </Link>
                ) : (
                  <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" variant="primary" form={FORM_ID} disabled={pending}>
                  {pending ? 'Saving…' : 'Save Record'}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setActionBaseline(state);
                  setEditing(true);
                }}
              >
                Edit Record
              </Button>
            )
          )}
        </div>
      </div>

      <main className="record-page">
        <div className="record-col">
          <OptionalForm action={formAction}>
            {from && <input type="hidden" name="from" value={from} />}

            <div className="record-head">
              {createMode ? (
                <>
                  <h1>Add Land Sale Record</h1>
                  <p className="sub">Manually enter a comp not covered by CSV import.</p>
                </>
              ) : (
                <>
                  <h1>{address || location || 'Land Sale Record'}</h1>
                  {subtitle && <p className="sub">{subtitle}</p>}
                </>
              )}
            </div>

            {tabbedPages.length > 0 && (
              <div className="record-tabs" role="tablist" aria-label="Record pages">
                {tabbedPages.map(page => (
                  <button
                    key={page.id}
                    type="button"
                    role="tab"
                    id={`record-tab-${page.id}`}
                    aria-selected={page.id === activePage}
                    aria-controls={`record-sheet-${page.id}`}
                    className="record-tab"
                    onClick={() => setActivePage(page.id)}
                  >
                    {page.title}
                  </button>
                ))}
              </div>
            )}

            {pages.map(page => (
              <section
                key={page.id}
                id={`record-sheet-${page.id}`}
                role={page.title === null ? undefined : 'tabpanel'}
                aria-labelledby={page.title === null ? undefined : `record-tab-${page.id}`}
                className="record-panel"
                hidden={page.title !== null && page.id !== activePage}
                onInvalidCapture={() => {
                  if (page.title !== null && page.id !== activePage) {
                    flushSync(() => setActivePage(page.id));
                  }
                }}
              >
                {page.title !== null && (
                  <div className="record-panel-title">
                    <h2>{page.title}</h2>
                  </div>
                )}

                <div className="record-grid">
                  {page.items.map(item => (
                    item.kind === 'group' ? (
                      <div key={`group-${item.id}`} className="record-field record-field-group record-span-12">
                        {item.label}
                      </div>
                    ) : (
                      <div key={item.column.key} className="record-field record-span-4">
                        <label htmlFor={editing ? fieldInputId(item.column.key) : undefined}>{item.column.label}</label>
                        <FieldControl header={item.column.key} record={record} editing={editing} />
                      </div>
                    )
                  ))}
                </div>

              </section>
            ))}

            {editing && displayState?.message && (
              <div className="record-error" style={{ marginBottom: 'var(--space-4)' }}>{displayState.message}</div>
            )}
            {deleteError && (
              <div className="record-error" style={{ marginBottom: 'var(--space-4)' }}>{deleteError}</div>
            )}

          </OptionalForm>
        </div>
      </main>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this record?"
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </button>
            <Button variant="primary" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--color-text)', margin: 0 }}>
          This cannot be undone. The record is removed from the database.
        </p>
      </Dialog>
    </>
  );
}
