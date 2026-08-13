'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { PROPERTY_TYPES, US_STATES } from '@/lib/land-sales/constants';
import { createLandSale, updateLandSale, type CreateFormState } from '@/app/(app)/land-sales/actions';
import type { LandSale } from '@/lib/land-sales/schema';

const initialState: CreateFormState = null;

export function LandSaleForm({ record, from }: { record?: LandSale; from?: string }) {
  const isEdit = !!record;
  const action = isEdit ? updateLandSale.bind(null, record.id) : createLandSale;
  const [state, formAction, pending] = useActionState(action, initialState);
  const errors = state?.errors ?? {};
  const backHref = '/land-sales';
  const backToSearchHref = from ? `/land-sales?${from}` : '/land-sales';

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) calc(var(--space-8) * 3)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-100)',
    }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        {isEdit && (
          <Link href={backToSearchHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-4)' }}>
            <ArrowLeft size={16} strokeWidth={2} />
            Back to search
          </Link>
        )}

        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: '0 0 var(--space-2)' }}>
          {isEdit ? 'Edit Land Sale Record' : 'Add Land Sale Record'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: '0 0 var(--space-6)' }}>
          {isEdit ? 'Update the details for this comp.' : 'Manually enter a comp not covered by CSV import.'}
        </p>

        <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', padding: 'var(--space-6)', background: '#FFFFFF' }}>
          <form action={formAction} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            {isEdit && from && <input type="hidden" name="from" value={from} />}
            <Field id="parcel_id" name="parcel_id" label="Parcel ID" type="text" placeholder="LND-10432" defaultValue={record?.parcel_id} error={errors.parcel_id} />
            <Field id="address" name="address" label="Address" type="text" placeholder="4820 County Road 12" defaultValue={record?.address} error={errors.address} />
            <Field id="city" name="city" label="City" type="text" required defaultValue={record?.city} error={errors.city} />
            <Field id="county" name="county" label="County" type="text" required defaultValue={record?.county} error={errors.county} />

            <div className="field">
              <label htmlFor="state">State</label>
              <select id="state" name="state" className="input" required defaultValue={record?.state ?? ''}>
                <option value="" disabled>Select a state</option>
                {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
              {errors.state && <div style={{ fontSize: 12, color: '#b3261e', marginTop: 4 }}>{errors.state}</div>}
            </div>
            <Field id="msa" name="msa" label="MSA" type="text" placeholder="Dallas-Fort Worth" defaultValue={record?.msa} error={errors.msa} />

            <div className="field">
              <label htmlFor="property_type">Property Type</label>
              <select id="property_type" name="property_type" className="input" required defaultValue={record?.property_type ?? ''}>
                <option value="" disabled>Select a type</option>
                {record?.property_type && !(PROPERTY_TYPES as readonly string[]).includes(record.property_type) && (
                  <option value={record.property_type}>{record.property_type} (imported)</option>
                )}
                {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.property_type && <div style={{ fontSize: 12, color: '#b3261e', marginTop: 4 }}>{errors.property_type}</div>}
            </div>
            <Field id="square_feet" name="square_feet" label="Square Feet" type="number" min={0} step="any" defaultValue={record?.square_feet ?? undefined} error={errors.square_feet} />

            <Field id="acreage" name="acreage" label="Acreage" type="number" min={0} step="any" required defaultValue={record?.acreage ?? undefined} error={errors.acreage} />
            <Field id="sale_date" name="sale_date" label="Sale Date" type="date" required defaultValue={record?.sale_date ?? undefined} error={errors.sale_date} />

            <Field id="sale_price" name="sale_price" label="Sale Price" type="number" min={0} step="any" required defaultValue={record?.sale_price ?? undefined} error={errors.sale_price} />
            <Field id="buyer" name="buyer" label="Buyer" type="text" defaultValue={record?.buyer} error={errors.buyer} />

            {state?.message && (
              <div style={{ gridColumn: '1 / -1', fontSize: 13, color: '#b3261e' }}>{state.message}</div>
            )}

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Record'}
              </Button>
            </div>
          </form>
        </Blueprint>
      </div>

      {!isEdit && (
        <Link href={backHref} className="blueprint" style={{
          position: 'fixed', bottom: 'var(--space-6)', left: 'var(--space-6)', display: 'flex',
          alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-6)',
          background: 'var(--color-bg)', color: 'var(--color-text)', boxShadow: 'var(--shadow-md)', textDecoration: 'none',
        }}>
          <ArrowLeft size={18} strokeWidth={2} />
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, letterSpacing: '0.03em' }}>BACK</span>
        </Link>
      )}
    </main>
  );
}
