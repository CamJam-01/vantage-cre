'use client';

import { useActionState } from 'react';
import { createLandSale, type CreateFormState } from '@/app/(app)/land-sales/actions';
import { RecordDetailsForm } from '@/components/land-sales/record-details';
import type { FieldDivider } from '@/lib/land-sales/field-visibility';
import { emptyLandSale } from '@/lib/land-sales/schema';

const initialState: CreateFormState = null;

export function LandSaleForm({
  hiddenFieldIds,
  fieldOrder,
  fieldDividers,
}: {
  hiddenFieldIds: string[];
  fieldOrder: string[];
  fieldDividers: FieldDivider[];
}) {
  const [state, formAction, pending] = useActionState(createLandSale, initialState);

  return (
    <RecordDetailsForm
      record={emptyLandSale()}
      canEdit
      startEditing
      createMode
      state={state}
      formAction={formAction}
      pending={pending}
      hiddenFieldIds={hiddenFieldIds}
      fieldOrder={fieldOrder}
      fieldDividers={fieldDividers}
    />
  );
}
