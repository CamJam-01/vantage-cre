'use client';

import { useActionState } from 'react';
import { createLandSale, type CreateFormState } from '@/app/(app)/land-sales/actions';
import { RecordDetailsForm } from '@/components/land-sales/record-details';
import type { ResultColumn } from '@/lib/land-sales/result-columns';
import type { FieldDivider } from '@/lib/land-sales/field-visibility';
import type { LandSale } from '@/lib/land-sales/schema';

const initialState: CreateFormState = null;

const BLANK_RECORD: LandSale = {
  id: '',
  parcel_id: '',
  address: '',
  city: '',
  county: '',
  state: '',
  msa: undefined,
  property_type: '',
  sale_date_raw: undefined,
  buyer: '',
  extras: {},
  price_per_acre: null,
  created_at: '',
  updated_at: '',
};

export function LandSaleForm({
  hiddenFieldIds,
  fieldOrder,
  fieldDividers,
}: {
  columns: ResultColumn[];
  hiddenFieldIds: string[];
  fieldOrder: string[];
  fieldDividers: FieldDivider[];
}) {
  const [state, formAction, pending] = useActionState(createLandSale, initialState);

  return (
    <RecordDetailsForm
      record={BLANK_RECORD}
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
