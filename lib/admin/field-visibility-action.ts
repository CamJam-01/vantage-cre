import { z } from 'zod';
import type { ResultColumn } from '../land-sales/result-columns';
import {
  DEFAULT_FIELD_DIVIDER_LABELS,
  FIELD_DIVIDER_LABEL_MAX_LENGTH,
  fieldDividerOrderId,
  SALES_DATABASE_KEY,
  validateFieldOrder,
  validateVisibleFieldIds,
  type DatabaseKey,
  type FieldDivider,
} from '../land-sales/field-visibility';

const fieldDividersSchema = z.array(z.object({
  id: z.string().trim().min(1).max(64),
  kind: z.enum(['page', 'group']),
  label: z.string().max(FIELD_DIVIDER_LABEL_MAX_LENGTH),
}));

export type VisibilitySubmission =
  | {
      ok: true;
      databaseKey: DatabaseKey;
      hiddenFieldIds: string[];
      fieldOrder: string[];
      fieldDividers: FieldDivider[];
    }
  | { ok: false; message: string };

type FieldDividerParse =
  | { ok: true; fieldDividers: FieldDivider[] }
  | { ok: false; message: string };

/** Dividers arrive as one JSON field because a divider's name is edited in
 * place, and paired `id` / `label` inputs would only stay aligned by document
 * order. */
function parseFieldDividers(raw: FormDataEntryValue | null): FieldDividerParse {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: true, fieldDividers: [] };

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'The pages and field groups could not be read.' };
  }

  const parsed = fieldDividersSchema.safeParse(decoded);
  if (!parsed.success) return { ok: false, message: 'The pages and field groups could not be read.' };

  const ids = new Set<string>();
  const fieldDividers: FieldDivider[] = [];
  for (const divider of parsed.data) {
    if (ids.has(divider.id)) return { ok: false, message: 'A page or field group is listed twice.' };
    ids.add(divider.id);
    // A name cleared while editing still has to title something on the record.
    fieldDividers.push({
      ...divider,
      label: divider.label.trim() || DEFAULT_FIELD_DIVIDER_LABELS[divider.kind],
    });
  }
  return { ok: true, fieldDividers };
}

export function parseVisibilitySubmission(
  formData: FormData,
  availableColumns: ResultColumn[],
): VisibilitySubmission {
  if (formData.get('database_key') !== SALES_DATABASE_KEY) {
    return {
      ok: false,
      message: 'This database is not available for field visibility settings.',
    };
  }

  const visibleFieldIds = formData.getAll('visible_field_id')
    .filter((value): value is string => typeof value === 'string');
  const validation = validateVisibleFieldIds(visibleFieldIds, availableColumns);
  if (!validation.ok) return validation;

  const dividers = parseFieldDividers(formData.get('field_dividers'));
  if (!dividers.ok) return dividers;

  // Order carries every field, hidden ones included, so unchecking a field does
  // not lose its place in the arrangement.
  const submittedOrder = formData.getAll('field_order_id')
    .filter((value): value is string => typeof value === 'string');
  const order = validateFieldOrder(submittedOrder, availableColumns, dividers.fieldDividers);
  if (!order.ok) return order;

  // A divider with no place in the order has nothing to title, so it is dropped.
  const placed = new Set(order.fieldOrder);
  return {
    ok: true,
    databaseKey: SALES_DATABASE_KEY,
    hiddenFieldIds: validation.hiddenFieldIds,
    fieldOrder: order.fieldOrder,
    fieldDividers: dividers.fieldDividers.filter(
      divider => placed.has(fieldDividerOrderId(divider)),
    ),
  };
}
