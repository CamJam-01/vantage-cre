'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
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
import { costarColumnType } from '@/lib/land-sales/costar-column-types';

const initialState: CreateFormState = null;

/** The Save controls live in the sticky action bar, outside the form, so
 * the form needs a stable id for their `form=` association. */
const FORM_ID = 'record-form';

function OptionalForm({
  action,
  nextHref,
  onDirty,
  children,
}: {
  action?: (formData: FormData) => void;
  nextHref?: string | null;
  onDirty?: () => void;
  children: ReactNode;
}) {
  if (!action) return children;
  return (
    <form id={FORM_ID} action={action} onInput={onDirty} onChange={onDirty}>
      {nextHref ? <input type="hidden" name="next" value={nextHref} /> : null}
      {children}
    </form>
  );
}

export function RecordDetails({
  record,
  from,
  canEdit,
  canDelete = false,
  hiddenFieldIds = [],
  fieldOrder = [],
  fieldDividers = [],
}: {
  record: LandSale;
  from?: string;
  canEdit: boolean;
  canDelete?: boolean;
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
    <BoundRecordDetailsForm
      key={record.id}
      record={record}
      from={from}
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
  canDelete,
  hiddenFieldIds,
  fieldOrder,
  fieldDividers,
}: {
  record: LandSale;
  from?: string;
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
      state={state}
      formAction={formAction}
      pending={pending}
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

function samePagePath(href: string): boolean {
  try {
    const url = new URL(href, window.location.origin);
    const next = url.pathname + url.search + url.hash;
    const current = window.location.pathname + window.location.search + window.location.hash;
    return next === current;
  } catch {
    return true;
  }
}

export function RecordDetailsForm({
  record,
  from,
  canEdit,
  canDelete = false,
  createMode = false,
  state = null,
  formAction,
  pending = false,
  hiddenFieldIds = [],
  fieldOrder = [],
  fieldDividers = [],
}: {
  record: LandSale;
  from?: string;
  canEdit: boolean;
  canDelete?: boolean;
  createMode?: boolean;
  state?: CreateFormState;
  formAction?: (formData: FormData) => void;
  pending?: boolean;
  hiddenFieldIds?: string[];
  fieldOrder?: string[];
  fieldDividers?: FieldDivider[];
}) {
  const router = useRouter();
  const hidden = new Set(hiddenFieldIds);
  const rows = fieldDisplayRows(resultColumns(), fieldOrder, fieldDividers);
  const pages = buildRecordDisplayPages(rows, hidden);
  const tabbedPages = pages.filter(page => page.title !== null);
  const editing = canEdit || createMode;
  const [activePage, setActivePage] = useState(tabbedPages[0]?.id ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [leavePrompt, setLeavePrompt] = useState<string | null>(null);
  const [nextHref, setNextHref] = useState<string | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
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

  useEffect(() => {
    if (!editing) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    }

    function onDocumentClick(event: MouseEvent) {
      if (!dirtyRef.current) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const next = url.pathname + url.search + url.hash;
      if (samePagePath(next)) return;

      event.preventDefault();
      event.stopPropagation();
      setLeavePrompt(next);
    }

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onDocumentClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onDocumentClick, true);
    };
  }, [editing]);

  function attemptLeave(href: string) {
    if (!editing || !dirty) {
      router.push(href);
      return;
    }
    setLeavePrompt(href);
  }

  function handleLeaveDiscard() {
    const href = leavePrompt;
    setLeavePrompt(null);
    setDirty(false);
    if (href) router.push(href);
  }

  function handleLeaveSave() {
    if (!leavePrompt || !formAction) return;
    flushSync(() => {
      setNextHref(leavePrompt);
      setLeavePrompt(null);
    });
    const form = document.getElementById(FORM_ID);
    if (form instanceof HTMLFormElement) form.requestSubmit();
  }

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
        {editing ? (
          <button type="button" className="record-bar-back" onClick={() => attemptLeave(backToSearchHref)}>
            <ArrowLeft size={15} strokeWidth={1.5} />
            Land Sales
          </button>
        ) : (
          <Link href={backToSearchHref} className="record-bar-back">
            <ArrowLeft size={15} strokeWidth={1.5} />
            Land Sales
          </Link>
        )}
        <div className="record-bar-actions">
          {editing && (
            <>
              {createMode && (
                <Button type="button" variant="secondary" onClick={() => attemptLeave('/land-sales')} disabled={pending}>
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                variant="primary"
                form={FORM_ID}
                disabled={pending}
                onClick={() => setNextHref(null)}
              >
                {pending ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      <main className="record-page">
        <div className="record-col">
          <OptionalForm
            action={formAction}
            nextHref={nextHref}
            onDirty={editing ? () => setDirty(true) : undefined}
          >
            {from && <input type="hidden" name="from" value={from} />}

            <div className="record-head">
              {createMode ? (
                <>
                  <h1>Add Land Sale Record</h1>
                  <p className="sub">Manually enter a comp not covered by CSV import.</p>
                </>
              ) : (
                <>
                  <div className="record-head-title">
                    <h1>{address || location || 'Land Sale Record'}</h1>
                    {canDelete && (
                      <Button type="button" variant="secondary" onClick={() => setConfirmDelete(true)}>
                        Delete
                      </Button>
                    )}
                  </div>
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

            {editing && state?.message && (
              <div className="record-error" style={{ marginBottom: 'var(--space-4)' }}>{state.message}</div>
            )}
            {deleteError && (
              <div className="record-error" style={{ marginBottom: 'var(--space-4)' }}>{deleteError}</div>
            )}

          </OptionalForm>
        </div>
      </main>

      <Dialog
        open={leavePrompt !== null}
        onClose={() => setLeavePrompt(null)}
        title="Unsaved changes"
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={handleLeaveDiscard} disabled={pending}>
              Discard
            </button>
            <Button variant="primary" onClick={handleLeaveSave} disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--color-text)', margin: 0 }}>
          You have unsaved changes. Would you like to save them?
        </p>
      </Dialog>

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
