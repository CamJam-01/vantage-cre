'use client';

import { useActionState } from 'react';
import { createLandSale, type CreateFormState } from '@/app/(app)/land-sales/actions';
import { RecordDetailsForm } from '@/components/land-sales/record-details';
import {
  DEFAULT_RECORD_IMAGE_PLACEMENT,
  type RecordImagePlacement,
} from '@/lib/land-sales/display-settings';
import type { FieldDivider } from '@/lib/land-sales/field-visibility';
import { emptyLandSale } from '@/lib/land-sales/schema';
import type { SalesPath } from '@/lib/land-sales/sales-path';

const initialState: CreateFormState = null;

export function LandSaleForm({
  path,
  hiddenFieldIds,
  fieldOrder,
  fieldDividers,
  recordImagePlacement = DEFAULT_RECORD_IMAGE_PLACEMENT,
}: {
  path: SalesPath;
  hiddenFieldIds: string[];
  fieldOrder: string[];
  fieldDividers: FieldDivider[];
  recordImagePlacement?: RecordImagePlacement;
}) {
  const [state, formAction, pending] = useActionState(createLandSale.bind(null, path.id), initialState);

  return (
    <RecordDetailsForm
      path={path}
      record={emptyLandSale()}
      canEdit
      createMode
      state={state}
      formAction={formAction}
      pending={pending}
      hiddenFieldIds={hiddenFieldIds}
      fieldOrder={fieldOrder}
      fieldDividers={fieldDividers}
      recordImagePlacement={recordImagePlacement}
    />
  );
}
