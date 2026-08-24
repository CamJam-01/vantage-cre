'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PROPERTY_TYPES, US_STATES } from '@/lib/land-sales/constants';
import { formatCurrency, formatDate, formatNumber } from '@/lib/land-sales/format';
import { updateLandSale, type CreateFormState } from '@/app/(app)/land-sales/actions';
import { extraInputName, type LandSale } from '@/lib/land-sales/schema';
import {
  DETAIL_COMPUTED_FIELDS,
  DETAIL_SHEETS,
  detailSheetFields,
  resultColumns,
  type CoreResultField,
  type DetailField,
} from '@/lib/land-sales/result-columns';
import {
  buildRecordDisplaySheets,
  visibleCoreField,
} from '@/lib/land-sales/field-visibility';
import {
  CURRENT_ACTION_STATE,
  visibleActionState,
} from '@/lib/land-sales/visible-action-state';

const initialState: CreateFormState = null;

/** Fields whose value is a record number or a figure — set in the mono face so
 * they line up column-wise down the sheet, as on a drafting title block. */
const MONO_FIELDS: CoreResultField[] = ['parcel_id', 'sale_date'];
const NUMERIC_FIELDS: CoreResultField[] = ['acreage', 'square_feet', 'sale_price', 'price_per_acre'];

function detailsHref(id: string, from?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  const qs = params.toString();
  return qs ? `/land-sales/${id}?${qs}` : `/land-sales/${id}`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="record-error">{message}</div>;
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

function saleDateWarning(record: LandSale): string | undefined {
  return !record.sale_date && record.sale_date_raw
    ? `Unrecognized date from import: "${record.sale_date_raw}". Flagged for review.`
    : undefined;
}

function fieldClassName(field: CoreResultField): string {
  if (MONO_FIELDS.includes(field)) return 'input mono';
  if (NUMERIC_FIELDS.includes(field)) return 'input num';
  return 'input';
}

/** View mode renders the same field grid as edit mode, with the values already
 * formatted for reading and the inputs locked — the design's sheets look
 * identical either way, so the only thing that changes is whether the field
 * accepts typing. Read-only inputs carry no `name`, so nothing here can reach a
 * submit even while the surrounding form is mounted for an editor. */
function lockedValue(record: LandSale, field: CoreResultField): string {
  switch (field) {
    case 'sale_date':
      return record.sale_date
        ? formatDate(record.sale_date)
        : record.sale_date_raw || '—';
    case 'sale_price':
    case 'price_per_acre':
      return formatCurrency(record[field]);
    case 'acreage':
      return record.acreage != null ? `${formatNumber(record.acreage)} AC` : '—';
    case 'square_feet':
      return record.square_feet != null ? `${formatNumber(record.square_feet)} SF` : '—';
    case 'parcel_id':
    case 'buyer':
    case 'msa':
    case 'property_type':
    case 'address':
    case 'city':
    case 'county':
    case 'state':
      return record[field] || '—';
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

function LockedField({ record, field }: { record: LandSale; field: CoreResultField }) {
  return (
    <input
      className={fieldClassName(field)}
      readOnly
      tabIndex={-1}
      value={lockedValue(record, field)}
    />
  );
}

/** An affixed unit or currency marker, matching the design's `$` / `AC` field
 * prefixes and suffixes. */
function Affixed({ affix, children }: { affix: string; children: ReactNode }) {
  return (
    <div className="record-affix">
      <span className="affix">{affix}</span>
      {children}
    </div>
  );
}

function EditableField({ record, field }: { record: LandSale; field: CoreResultField }) {
  const importedPropertyType =
    record.property_type && !(PROPERTY_TYPES as readonly string[]).includes(record.property_type)
      ? record.property_type
      : null;

  switch (field) {
    case 'sale_date':
      return (
        <input
          id="sale_date"
          name="sale_date"
          type="date"
          className="input mono"
          defaultValue={record.sale_date ?? undefined}
        />
      );
    case 'sale_price':
      return (
        <Affixed affix="$">
          <input
            id="sale_price"
            name="sale_price"
            type="number"
            min={0}
            step="any"
            className="input num"
            defaultValue={record.sale_price ?? undefined}
          />
        </Affixed>
      );
    case 'acreage':
      return (
        <input
          id="acreage"
          name="acreage"
          type="number"
          min={0}
          step="any"
          className="input num"
          defaultValue={record.acreage ?? undefined}
        />
      );
    case 'square_feet':
      return (
        <input
          id="square_feet"
          name="square_feet"
          type="number"
          min={0}
          step="any"
          className="input num"
          defaultValue={record.square_feet ?? undefined}
        />
      );
    case 'property_type':
      return (
        <select
          id="property_type"
          name="property_type"
          className="input"
          defaultValue={record.property_type ?? ''}
        >
          <option value="">Select a type</option>
          {importedPropertyType && (
            <option value={importedPropertyType}>{importedPropertyType} (imported)</option>
          )}
          {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      );
    case 'state':
      return (
        <select
          id="state"
          name="state"
          className="input"
          defaultValue={record.state}
        >
          <option value="">Select</option>
          {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      );
    case 'city':
      return (
        <input id="city" name="city" type="text" className="input" defaultValue={record.city} />
      );
    case 'county':
      return (
        <input id="county" name="county" type="text" className="input" defaultValue={record.county} />
      );
    case 'address':
      return (
        <input
          id="address"
          name="address"
          type="text"
          className="input"
          placeholder="4820 County Road 12"
          defaultValue={record.address}
        />
      );
    case 'buyer':
      return <input id="buyer" name="buyer" type="text" className="input" defaultValue={record.buyer} />;
    case 'parcel_id':
      return (
        <input
          id="parcel_id"
          name="parcel_id"
          type="text"
          className="input mono"
          placeholder="LND-10432"
          defaultValue={record.parcel_id}
        />
      );
    case 'msa':
      return (
        <input
          id="msa"
          name="msa"
          type="text"
          className="input"
          placeholder="Dallas-Fort Worth"
          defaultValue={record.msa}
        />
      );
    case 'price_per_acre':
      return null;
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

function SheetField({
  record,
  field,
  editing,
  error,
}: {
  record: LandSale;
  field: DetailField;
  editing: boolean;
  error?: string;
}) {
  const computed = DETAIL_COMPUTED_FIELDS.includes(field.key);
  const editable = editing && !computed;
  const warning = field.key === 'sale_date' ? saleDateWarning(record) : undefined;

  return (
    <div className={`record-field record-span-${field.span}`}>
      <label htmlFor={editable ? field.key : undefined}>{field.label}</label>
      {editable && warning && (
        <div className="record-flag" title={warning}>
          <TriangleAlert size={13} strokeWidth={2} />
          {record.sale_date_raw}
        </div>
      )}
      {editable ? <EditableField record={record} field={field.key} /> : <LockedField record={record} field={field.key} />}
      {!editing && warning && (
        <div className="record-flag" title={warning}>
          <TriangleAlert size={13} strokeWidth={2} />
          Flagged for review
        </div>
      )}
      {editable && <FieldError message={error} />}
    </div>
  );
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

function RecordDetailsForm({
  record,
  from,
  canEdit,
  startEditing = false,
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
  state?: CreateFormState;
  formAction?: (formData: FormData) => void;
  pending?: boolean;
  onCancel?: () => void;
  catalogLabels?: string[];
  hiddenFieldIds?: string[];
}) {
  const hidden = new Set(hiddenFieldIds);
  const columns = resultColumns({ catalogLabels });
  const visibleSheets = buildRecordDisplaySheets(DETAIL_SHEETS, columns, hidden);
  const [editing, setEditing] = useState(canEdit && startEditing);
  const [activeSheet, setActiveSheet] = useState(visibleSheets[0]?.id ?? 'additional');
  const [actionBaseline, setActionBaseline] = useState<CreateFormState | typeof CURRENT_ACTION_STATE>(
    startEditing ? CURRENT_ACTION_STATE : state,
  );
  const displayState = visibleActionState(state, actionBaseline);
  const errors = displayState?.errors ?? {};
  const backToSearchHref = from ? `/land-sales?${from}` : '/land-sales';
  const activeIndex = Math.max(0, visibleSheets.findIndex(sheet => sheet.id === activeSheet));

  // Server-side validation can reject a field on whichever sheet isn't showing;
  // surface that sheet so the message under the field is actually visible. This
  // is the render-phase state adjustment React prescribes for reacting to new
  // props — `shownErrorSheet` remembers which rejection has already been acted
  // on, so the user stays free to tab away while the error is still standing.
  const errorSheetId = Object.keys(errors).length
    ? visibleSheets.find(sheet => detailSheetFields(sheet).some(field => field.key in errors))?.id ?? null
    : null;
  const [shownErrorSheet, setShownErrorSheet] = useState<string | null>(null);
  if (errorSheetId !== shownErrorSheet) {
    setShownErrorSheet(errorSheetId);
    if (errorSheetId) setActiveSheet(errorSheetId);
  }

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
                <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
                  Cancel
                </Button>
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
              <div className="tags">
                {visibleCoreField('parcel_id', hidden) && record.parcel_id && (
                  <span className="tag tag-on-ground mono">{record.parcel_id}</span>
                )}
                {visibleCoreField('property_type', hidden) && record.property_type && (
                  <span className="tag tag-accent">{record.property_type}</span>
                )}
              </div>
              <h1>
                {visibleCoreField('address', hidden) && record.address
                  ? record.address
                  : [
                      visibleCoreField('city', hidden) ? record.city : '',
                      visibleCoreField('state', hidden) ? record.state : '',
                    ].filter(Boolean).join(', ') || 'Land Sale Record'}
              </h1>
              {[
                [
                  visibleCoreField('city', hidden) ? record.city : '',
                  visibleCoreField('state', hidden) ? record.state : '',
                ].filter(Boolean).join(', '),
                visibleCoreField('county', hidden) && record.county ? `${record.county} County` : '',
                visibleCoreField('msa', hidden) ? record.msa : '',
              ].filter(Boolean).length > 0 && (
                <p className="sub">
                  {[
                    [
                      visibleCoreField('city', hidden) ? record.city : '',
                      visibleCoreField('state', hidden) ? record.state : '',
                    ].filter(Boolean).join(', '),
                    visibleCoreField('county', hidden) && record.county ? `${record.county} County` : '',
                    visibleCoreField('msa', hidden) ? record.msa : '',
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>

            <div className="record-tabs" role="tablist" aria-label="Record sheets">
              {visibleSheets.map((sheet, index) => (
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
                  <span className="sheet-no">{index + 1}</span>
                  {sheet.tab}
                </button>
              ))}
            </div>

            {visibleSheets.map((sheet, index) => (
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
                  <span className="hint">Sheet {index + 1} of {visibleSheets.length}</span>
                </div>

                <div className="record-grid">
                  {sheet.sections.map((section, sectionIndex) => (
                    <SheetSection key={section.label ?? sectionIndex} first={sectionIndex === 0} label={section.label}>
                      {section.fields.map(field => (
                        <SheetField
                          key={field.key}
                          record={record}
                          field={field}
                          editing={editing}
                          error={errors[field.key]}
                        />
                      ))}
                    </SheetSection>
                  ))}

                  {/* Imported columns have no home in the drafting sheets, so
                      they land as a final band on the last one. */}
                  {sheet.extraColumns.length > 0 && (
                    <SheetSection first={false} label="Additional Fields">
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

            <div className="record-titleblock">
              <div>
                <span className="tb-label">Record</span>
                <span className="tb-value">{record.parcel_id || '—'}</span>
              </div>
              <div>
                <span className="tb-label">Type</span>
                <span className="tb-value">{record.property_type || '—'}</span>
              </div>
              <div>
                <span className="tb-label">Created</span>
                <span className="tb-value">{formatDate(record.created_at?.slice(0, 10))}</span>
              </div>
              <div>
                <span className="tb-label">Last Updated</span>
                <span className="tb-value">{formatDate(record.updated_at?.slice(0, 10))}</span>
              </div>
              <div>
                <span className="tb-label">Sheet</span>
                <span className="tb-value">{activeIndex + 1}/{visibleSheets.length}</span>
              </div>
            </div>
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
