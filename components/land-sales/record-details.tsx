'use client';

import { useActionState, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';
import { Button } from '@/components/ui/button';
import { PROPERTY_TYPES, US_STATES } from '@/lib/land-sales/constants';
import { formatCurrency, formatDate, formatNumber } from '@/lib/land-sales/format';
import { updateLandSale, type CreateFormState } from '@/app/(app)/land-sales/actions';
import type { LandSale } from '@/lib/land-sales/schema';

const initialState: CreateFormState = null;

const labelStyle: CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.05em',
  color: 'var(--color-neutral-700)',
  textTransform: 'uppercase',
  marginBottom: 'var(--space-1)',
  display: 'block',
};

const valueStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--color-text)',
};

const errorStyle: CSSProperties = {
  fontSize: 12,
  color: '#b3261e',
  marginTop: 4,
};

function detailsHref(id: string, from?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  const qs = params.toString();
  return qs ? `/land-sales/${id}?${qs}` : `/land-sales/${id}`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <div style={errorStyle}>{message}</div>;
}

function LockedValue({ children, warning }: { children: ReactNode; warning?: string }) {
  if (warning) {
    return (
      <div title={warning} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 18, fontWeight: 600, color: '#92400e' }}>
        <TriangleAlert size={16} strokeWidth={2} />
        {children}
      </div>
    );
  }
  return <div style={valueStyle}>{children}</div>;
}

function DetailField({
  label,
  htmlFor,
  editing,
  error,
  locked,
  children,
}: {
  label: string;
  htmlFor?: string;
  editing: boolean;
  error?: string;
  locked: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={editing ? htmlFor : undefined} style={labelStyle}>{label}</label>
      {editing ? children : locked}
      {editing && <FieldError message={error} />}
    </div>
  );
}

export function RecordDetails({
  record,
  from,
  canEdit,
  startEditing = false,
}: {
  record: LandSale;
  from?: string;
  canEdit: boolean;
  startEditing?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState(canEdit && startEditing);
  const [state, formAction, pending] = useActionState(updateLandSale.bind(null, record.id), initialState);
  const errors = state?.errors ?? {};
  const backToSearchHref = from ? `/land-sales?${from}` : '/land-sales';
  const saleDateWarning = !record.sale_date && record.sale_date_raw
    ? `Unrecognized date from import: "${record.sale_date_raw}". Flagged for review.`
    : undefined;
  const importedPropertyType = record.property_type && !(PROPERTY_TYPES as readonly string[]).includes(record.property_type)
    ? record.property_type
    : null;

  function handleCancel() {
    formRef.current?.reset();
    setEditing(false);
    router.replace(detailsHref(record.id, from));
  }

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) calc(var(--space-8) * 3)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-200)',
    }}>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <Link href={backToSearchHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-4)' }}>
          <ArrowLeft size={16} strokeWidth={2} />
          Back to search
        </Link>

        <form ref={formRef} action={formAction}>
          {from && <input type="hidden" name="from" value={from} />}

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tag tag-outline" style={{ marginBottom: 'var(--space-2)' }}>{record.parcel_id || record.id}</div>
              {editing ? (
                <>
                  <input
                    id="address"
                    name="address"
                    type="text"
                    aria-label="Address"
                    className="input"
                    placeholder="4820 County Road 12"
                    defaultValue={record.address}
                    style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', minHeight: 48 }}
                  />
                  <FieldError message={errors.address} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)', fontSize: 15, color: 'var(--color-neutral-700)' }}>
                    <input
                      id="city"
                      name="city"
                      type="text"
                      aria-label="City"
                      className="input"
                      required
                      defaultValue={record.city}
                      style={{ width: 140 }}
                    />
                    <span>,</span>
                    <select
                      id="state"
                      name="state"
                      aria-label="State"
                      className="input"
                      required
                      defaultValue={record.state}
                      style={{ width: 200 }}
                    >
                      <option value="" disabled>Select a state</option>
                      {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                    </select>
                    <span>·</span>
                    <input
                      id="county"
                      name="county"
                      type="text"
                      aria-label="County"
                      className="input"
                      required
                      defaultValue={record.county}
                      style={{ width: 140 }}
                    />
                    <span>County</span>
                  </div>
                  <FieldError message={errors.city} />
                  <FieldError message={errors.state} />
                  <FieldError message={errors.county} />
                </>
              ) : (
                <>
                  <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: 0 }}>
                    {record.address || `${record.city}, ${record.state}`}
                  </h1>
                  <p style={{ fontSize: 15, color: 'var(--color-neutral-700)', margin: 'var(--space-1) 0 0' }}>
                    {record.city}, {record.state} · {record.county} County
                  </p>
                </>
              )}
            </div>
            {canEdit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
                {editing ? (
                  <>
                    <Button type="button" variant="ghost" onClick={handleCancel} disabled={pending}>Cancel</Button>
                    <Button type="submit" variant="primary" disabled={pending}>
                      {pending ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
                )}
              </div>
            )}
          </div>

          <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', padding: 'var(--space-6)', background: 'var(--color-neutral-100)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
              <DetailField
                label="Sale Date"
                htmlFor="sale_date"
                editing={editing}
                error={errors.sale_date}
                locked={
                  <LockedValue warning={saleDateWarning}>
                    {record.sale_date ? formatDate(record.sale_date) : record.sale_date_raw ? record.sale_date_raw : '—'}
                  </LockedValue>
                }
              >
                {saleDateWarning && (
                  <div title={saleDateWarning} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>
                    <TriangleAlert size={14} strokeWidth={2} />
                    {record.sale_date_raw}
                  </div>
                )}
                <input
                  id="sale_date"
                  name="sale_date"
                  type="date"
                  className="input"
                  required
                  defaultValue={record.sale_date ?? undefined}
                />
              </DetailField>

              <DetailField
                label="Sale Price"
                htmlFor="sale_price"
                editing={editing}
                error={errors.sale_price}
                locked={<LockedValue>{formatCurrency(record.sale_price)}</LockedValue>}
              >
                <input
                  id="sale_price"
                  name="sale_price"
                  type="number"
                  min={0}
                  step="any"
                  className="input"
                  required
                  defaultValue={record.sale_price ?? undefined}
                />
              </DetailField>

              <DetailField
                label="Acreage"
                htmlFor="acreage"
                editing={editing}
                error={errors.acreage}
                locked={<LockedValue>{record.acreage != null ? `${formatNumber(record.acreage)} AC` : '—'}</LockedValue>}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    id="acreage"
                    name="acreage"
                    type="number"
                    min={0}
                    step="any"
                    className="input"
                    required
                    defaultValue={record.acreage ?? undefined}
                  />
                  <span style={valueStyle}>AC</span>
                </div>
              </DetailField>

              <div>
                <div style={labelStyle}>Price / Acre</div>
                <LockedValue>{formatCurrency(record.price_per_acre)}</LockedValue>
              </div>

              <DetailField
                label="Square Feet"
                htmlFor="square_feet"
                editing={editing}
                error={errors.square_feet}
                locked={<LockedValue>{record.square_feet != null ? `${formatNumber(record.square_feet)} SF` : '—'}</LockedValue>}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    id="square_feet"
                    name="square_feet"
                    type="number"
                    min={0}
                    step="any"
                    className="input"
                    defaultValue={record.square_feet ?? undefined}
                  />
                  <span style={valueStyle}>SF</span>
                </div>
              </DetailField>

              <DetailField
                label="Property Type"
                htmlFor="property_type"
                editing={editing}
                error={errors.property_type}
                locked={<LockedValue>{record.property_type}</LockedValue>}
              >
                <select
                  id="property_type"
                  name="property_type"
                  className="input"
                  required
                  defaultValue={record.property_type ?? ''}
                >
                  <option value="" disabled>Select a type</option>
                  {importedPropertyType && (
                    <option value={importedPropertyType}>{importedPropertyType} (imported)</option>
                  )}
                  {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </DetailField>

              <DetailField
                label="Buyer"
                htmlFor="buyer"
                editing={editing}
                error={errors.buyer}
                locked={<LockedValue>{record.buyer || '—'}</LockedValue>}
              >
                <input
                  id="buyer"
                  name="buyer"
                  type="text"
                  className="input"
                  defaultValue={record.buyer}
                />
              </DetailField>

              <DetailField
                label="Parcel ID"
                htmlFor="parcel_id"
                editing={editing}
                error={errors.parcel_id}
                locked={<LockedValue>{record.parcel_id || '—'}</LockedValue>}
              >
                <input
                  id="parcel_id"
                  name="parcel_id"
                  type="text"
                  className="input"
                  placeholder="LND-10432"
                  defaultValue={record.parcel_id}
                />
              </DetailField>

              <DetailField
                label="MSA"
                htmlFor="msa"
                editing={editing}
                error={errors.msa}
                locked={<LockedValue>{record.msa || '—'}</LockedValue>}
              >
                <input
                  id="msa"
                  name="msa"
                  type="text"
                  className="input"
                  placeholder="Dallas-Fort Worth"
                  defaultValue={record.msa}
                />
              </DetailField>
            </div>

            {state?.message && (
              <div style={{ fontSize: 13, color: '#b3261e', marginTop: 'var(--space-4)' }}>{state.message}</div>
            )}
          </Blueprint>
        </form>
      </div>
    </main>
  );
}
