'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { createLandSale, type CreateFormState } from '@/app/(app)/land-sales/actions';
import { extraInputName } from '@/lib/land-sales/schema';
import type { ResultColumn } from '@/lib/land-sales/result-columns';
import { filterVisibleColumns } from '@/lib/land-sales/field-visibility';

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
  const visibleColumns = filterVisibleColumns(columns, hidden);
  const extraColumns = visibleColumns
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
