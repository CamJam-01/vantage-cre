'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { PROPERTY_TYPES, US_STATES } from '@/lib/land-sales/constants';
import { createLandSale, type CreateFormState } from '@/app/(app)/land-sales/actions';
import { extraInputName } from '@/lib/land-sales/schema';
import type { ResultColumn } from '@/lib/land-sales/result-columns';
import {
  filterVisibleColumns,
  visibleCoreField,
} from '@/lib/land-sales/field-visibility';

const initialState: CreateFormState = null;

export function LandSaleForm({
  columns,
  hiddenFieldIds,
}: {
  columns: ResultColumn[];
  hiddenFieldIds: string[];
}) {
  const [state, formAction, pending] = useActionState(createLandSale, initialState);
  const errors = state?.errors ?? {};
  const backHref = '/land-sales';
  const hidden = new Set(hiddenFieldIds);
  const extraColumns = filterVisibleColumns(columns, hidden)
    .filter((column): column is Extract<ResultColumn, { kind: 'extra' }> => column.kind === 'extra');

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) calc(var(--space-8) * 3)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-100)',
    }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: '0 0 var(--space-2)' }}>
          Add Land Sale Record
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: '0 0 var(--space-6)' }}>
          Manually enter a comp not covered by CSV import.
        </p>

        <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', padding: 'var(--space-6)', background: '#FFFFFF' }}>
          <form action={formAction} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            {visibleCoreField('parcel_id', hidden) && (
              <Field id="parcel_id" name="parcel_id" label="Parcel ID" type="text" placeholder="LND-10432" error={errors.parcel_id} />
            )}
            {visibleCoreField('address', hidden) && (
              <Field id="address" name="address" label="Address" type="text" placeholder="4820 County Road 12" error={errors.address} />
            )}
            {visibleCoreField('city', hidden) && (
              <Field id="city" name="city" label="City" type="text" error={errors.city} />
            )}
            {visibleCoreField('county', hidden) && (
              <Field id="county" name="county" label="County" type="text" error={errors.county} />
            )}

            {visibleCoreField('state', hidden) && (
              <div className="field">
                <label htmlFor="state">State</label>
                <select id="state" name="state" className="input" defaultValue="">
                  <option value="">Select a state</option>
                  {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
                {errors.state && <div style={{ fontSize: 12, color: '#b3261e', marginTop: 4 }}>{errors.state}</div>}
              </div>
            )}
            {visibleCoreField('msa', hidden) && (
              <Field id="msa" name="msa" label="MSA" type="text" placeholder="Dallas-Fort Worth" error={errors.msa} />
            )}

            {visibleCoreField('property_type', hidden) && (
              <div className="field">
                <label htmlFor="property_type">Property Type</label>
                <select id="property_type" name="property_type" className="input" defaultValue="">
                  <option value="">Select a type</option>
                  {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.property_type && <div style={{ fontSize: 12, color: '#b3261e', marginTop: 4 }}>{errors.property_type}</div>}
              </div>
            )}
            {visibleCoreField('square_feet', hidden) && (
              <Field id="square_feet" name="square_feet" label="Square Feet" type="number" min={0} step="any" error={errors.square_feet} />
            )}

            {visibleCoreField('acreage', hidden) && (
              <Field id="acreage" name="acreage" label="Acreage" type="number" min={0} step="any" error={errors.acreage} />
            )}
            {visibleCoreField('sale_date', hidden) && (
              <Field id="sale_date" name="sale_date" label="Sale Date" type="date" error={errors.sale_date} />
            )}

            {visibleCoreField('sale_price', hidden) && (
              <Field id="sale_price" name="sale_price" label="Sale Price" type="number" min={0} step="any" error={errors.sale_price} />
            )}
            {visibleCoreField('price_per_acre', hidden) && (
              <Field id="price_per_acre" label="Price / Acre" type="text" value="Calculated after save" readOnly tabIndex={-1} />
            )}
            {visibleCoreField('buyer', hidden) && (
              <Field id="buyer" name="buyer" label="Buyer" type="text" error={errors.buyer} />
            )}

            {extraColumns.map(column => (
              <Field
                key={column.key}
                id={extraInputName(column.key)}
                name={extraInputName(column.key)}
                label={column.label}
                type="text"
              />
            ))}

            {state?.message && (
              <div style={{ gridColumn: '1 / -1', fontSize: 13, color: '#b3261e' }}>{state.message}</div>
            )}

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? 'Saving…' : 'Save Record'}
              </Button>
            </div>
          </form>
        </Blueprint>
      </div>

      <Link href={backHref} className="blueprint" style={{
        position: 'fixed', bottom: 'var(--space-6)', left: 'var(--space-6)', display: 'flex',
        alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-6)',
        background: 'var(--color-bg)', color: 'var(--color-text)', boxShadow: 'var(--shadow-md)', textDecoration: 'none',
      }}>
        <ArrowLeft size={18} strokeWidth={2} />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, letterSpacing: '0.03em' }}>BACK</span>
      </Link>
    </main>
  );
}
