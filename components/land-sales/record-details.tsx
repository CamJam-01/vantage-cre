'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateLandSale, type CreateFormState } from '@/app/(app)/land-sales/actions';
import { extraInputName, type LandSale } from '@/lib/land-sales/schema';
import { resultColumns } from '@/lib/land-sales/result-columns';
import {
  buildDatabaseRecordDisplaySheets,
  visibleExtraField,
} from '@/lib/land-sales/field-visibility';
import {
  CURRENT_ACTION_STATE,
  visibleActionState,
} from '@/lib/land-sales/visible-action-state';

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
  startEditing = false,
  catalogLabels = [],
  hiddenFieldIds = [],
}: {
  record: LandSale;
  from?: string;
  canEdit: boolean;
  startEditing?: boolean;
  catalogLabels?: string[];
  hiddenFieldIds?: string[];
}) {
  if (!canEdit) {
    return <RecordDetailsForm record={record} from={from} canEdit={false} catalogLabels={catalogLabels} hiddenFieldIds={hiddenFieldIds} />;
  }
  return (
    <RecordDetailsEditor
      key={record.id}
      record={record}
      from={from}
      startEditing={startEditing}
      catalogLabels={catalogLabels}
      hiddenFieldIds={hiddenFieldIds}
    />
  );
}

function RecordDetailsEditor({
  record,
  from,
  startEditing = false,
  catalogLabels,
  hiddenFieldIds,
}: {
  record: LandSale;
  from?: string;
  startEditing?: boolean;
  catalogLabels: string[];
  hiddenFieldIds: string[];
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
      catalogLabels={catalogLabels}
      hiddenFieldIds={hiddenFieldIds}
    />
  );
}

function BoundRecordDetailsForm({
  record,
  from,
  startEditing,
  onCancel,
  catalogLabels,
  hiddenFieldIds,
}: {
  record: LandSale;
  from?: string;
  startEditing: boolean;
  onCancel: () => void;
  catalogLabels: string[];
  hiddenFieldIds: string[];
}) {
  const [state, formAction, pending] = useActionState(updateLandSale.bind(null, record.id), initialState);
  return (
    <RecordDetailsForm
      record={record}
      from={from}
      canEdit
      startEditing={startEditing}
      state={state}
      formAction={formAction}
      pending={pending}
      onCancel={onCancel}
      catalogLabels={catalogLabels}
      hiddenFieldIds={hiddenFieldIds}
    />
  );
}

export function RecordDetailsForm({
  record,
  from,
  canEdit,
  startEditing = false,
  createMode = false,
  state = null,
  formAction,
  pending = false,
  onCancel,
  catalogLabels = [],
  hiddenFieldIds = [],
}: {
  record: LandSale;
  from?: string;
  canEdit: boolean;
  startEditing?: boolean;
  createMode?: boolean;
  state?: CreateFormState;
  formAction?: (formData: FormData) => void;
  pending?: boolean;
  onCancel?: () => void;
  catalogLabels?: string[];
  hiddenFieldIds?: string[];
}) {
  const hidden = new Set(hiddenFieldIds);
  // `resultColumns` is the catalog of physical CoStar columns in Supabase.
  // Do not prepend the former app-only core aliases: those are deprecated and
  // are not configurable in Database Manager.
  const columns = resultColumns({ catalogLabels });
  const visibleSheets = buildDatabaseRecordDisplaySheets(columns, hidden);
  const [editing, setEditing] = useState(canEdit && (startEditing || createMode));
  const [activeSheet, setActiveSheet] = useState(visibleSheets[0]?.id ?? 'property-details');
  const [actionBaseline, setActionBaseline] = useState<CreateFormState | typeof CURRENT_ACTION_STATE>(
    startEditing ? CURRENT_ACTION_STATE : state,
  );
  const displayState = visibleActionState(state, actionBaseline);
  const backToSearchHref = from ? `/land-sales?${from}` : '/land-sales';

  const visibleValue = (label: string) => (
    visibleExtraField(label, hidden) ? record.extras?.[label]?.trim() ?? '' : ''
  );
  const address = visibleValue('Property Address');
  const city = visibleValue('Property City');
  const stateName = visibleValue('Property State');
  const county = visibleValue('Property County');
  const location = [city, stateName].filter(Boolean).join(', ');
  const subtitle = [county ? `${county} County` : '', location]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <div className="record-bar">
        <Link href={backToSearchHref} className="record-bar-back">
          <ArrowLeft size={15} strokeWidth={2} />
          Land Sales
        </Link>
        {canEdit && (
          <div className="record-bar-actions">
            {editing ? (
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
            )}
          </div>
        )}
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

            <div className="record-tabs" role="tablist" aria-label="Record sheets">
              {visibleSheets.map(sheet => (
                <button
                  key={sheet.id}
                  type="button"
                  role="tab"
                  id={`record-tab-${sheet.id}`}
                  aria-selected={sheet.id === activeSheet}
                  aria-controls={`record-sheet-${sheet.id}`}
                  className="record-tab"
                  onClick={() => setActiveSheet(sheet.id)}
                >
                  {sheet.tab}
                </button>
              ))}
            </div>

            {visibleSheets.map(sheet => (
              <section
                key={sheet.id}
                id={`record-sheet-${sheet.id}`}
                role="tabpanel"
                aria-labelledby={`record-tab-${sheet.id}`}
                className="record-panel"
                /* Hidden rather than unmounted: a save submits every field on
                   every sheet, including whatever the user typed before
                   switching tabs. The flip side is that a `required` field can
                   fail native validation while off-screen — which the browser
                   reports by silently refusing to submit — so bring its sheet
                   forward synchronously before the browser tries to focus it. */
                hidden={sheet.id !== activeSheet}
                onInvalidCapture={() => {
                  if (sheet.id !== activeSheet) flushSync(() => setActiveSheet(sheet.id));
                }}
              >
                <div className="record-panel-title">
                  <h2>{sheet.title}</h2>
                </div>

                <div className="record-grid">
                  {/* Every field here corresponds to a physical Supabase
                      column and has already passed the Admin visibility filter. */}
                  {sheet.extraColumns.length > 0 && (
                    <SheetSection first>
                      {sheet.extraColumns.map(column => (
                        <div key={column.key} className="record-field record-span-4">
                          <label htmlFor={editing ? extraInputName(column.key) : undefined}>{column.label}</label>
                          {editing ? (
                            <input
                              id={extraInputName(column.key)}
                              name={extraInputName(column.key)}
                              type="text"
                              className="input"
                              defaultValue={record.extras?.[column.key] ?? ''}
                            />
                          ) : (
                            <input
                              className="input"
                              readOnly
                              tabIndex={-1}
                              value={record.extras?.[column.key] || '—'}
                            />
                          )}
                        </div>
                      ))}
                    </SheetSection>
                  )}
                </div>

                {editing && displayState?.message && (
                  <div className="record-error" style={{ marginTop: 'var(--space-4)' }}>{displayState.message}</div>
                )}
              </section>
            ))}

          </OptionalForm>
        </div>
      </main>
    </>
  );
}

function SheetSection({
  first,
  label,
  children,
}: {
  first: boolean;
  label?: string;
  children: ReactNode;
}) {
  return (
    <>
      {!first && <div className="record-divider" />}
      {label && <div className="record-section-label">{label}</div>}
      {children}
    </>
  );
}
