import { costarColumnNames } from './costar-fields';

export const OUTPUT_FLOW_OPERATORS = ['contains', 'equals', 'does_not_equal'] as const;
export type OutputFlowOperator = typeof OUTPUT_FLOW_OPERATORS[number];

export const OUTPUT_FLOW_NAME_MAX_LENGTH = 80;
export const OUTPUT_FLOW_VALUE_MAX_LENGTH = 200;
export const OUTPUT_FLOW_CONDITION_LIMIT = 20;

export type OutputFlowCondition = {
  id: string;
  field: string;
  operator: OutputFlowOperator;
  value: string;
  templateId: string;
  position: number;
};

export type DocxOutputFlow = {
  id: string;
  name: string;
  defaultTemplateId: string;
  conditions: OutputFlowCondition[];
  updatedAt: string;
};

export type OutputFlowConditionDraft = Omit<OutputFlowCondition, 'id' | 'position'>;

export type OutputFlowDraft = {
  id: string | null;
  name: string;
  defaultTemplateId: string;
  conditions: OutputFlowConditionDraft[];
};

export const OUTPUT_FLOW_OPERATOR_LABELS: Record<OutputFlowOperator, string> = {
  contains: 'contains',
  equals: 'equals',
  does_not_equal: 'does not equal',
};

function normalizedText(value: unknown): string {
  return value == null ? '' : String(value).trim().toLocaleLowerCase('en-US');
}

/** Output routing compares display-independent stored values as forgiving,
 * case-insensitive text so an Admin's "Sold" rule does not depend on casing. */
export function outputFlowConditionMatches(
  condition: Pick<OutputFlowCondition, 'operator' | 'value'>,
  recordValue: unknown,
): boolean {
  const actual = normalizedText(recordValue);
  const expected = normalizedText(condition.value);

  switch (condition.operator) {
    case 'contains':
      return actual.includes(expected);
    case 'equals':
      return actual === expected;
    case 'does_not_equal':
      return actual !== expected;
    default: {
      const _exhaustive: never = condition.operator;
      return _exhaustive;
    }
  }
}

/** Conditions are evaluated in stored order and the first match wins. The
 * required default makes routing total even for blank or unexpected values. */
export function resolveOutputTemplateId(
  flow: Pick<DocxOutputFlow, 'defaultTemplateId' | 'conditions'>,
  columns: Readonly<Record<string, unknown>>,
): string {
  const ordered = [...flow.conditions].sort((a, b) => a.position - b.position);
  const match = ordered.find(condition =>
    outputFlowConditionMatches(condition, columns[condition.field]),
  );
  return match?.templateId ?? flow.defaultTemplateId;
}

/** Shared client/server validation. Template ids are checked against the
 * caller's current saved-template set so stale or crafted references fail. */
export function outputFlowDraftError(
  draft: OutputFlowDraft,
  templateIds: ReadonlySet<string>,
): string | null {
  const name = draft.name.trim();
  if (!name) return 'Give the output flow a name.';
  if (name.length > OUTPUT_FLOW_NAME_MAX_LENGTH) {
    return `Output flow names must be ${OUTPUT_FLOW_NAME_MAX_LENGTH} characters or fewer.`;
  }
  if (!templateIds.has(draft.defaultTemplateId)) return 'Choose a saved default template.';
  if (draft.conditions.length > OUTPUT_FLOW_CONDITION_LIMIT) {
    return `An output flow can have up to ${OUTPUT_FLOW_CONDITION_LIMIT} conditions.`;
  }

  const fields = new Set(costarColumnNames());
  for (const condition of draft.conditions) {
    if (!fields.has(condition.field)) return 'Choose a valid database field for every condition.';
    if (!OUTPUT_FLOW_OPERATORS.includes(condition.operator)) return 'Choose a valid operator.';
    const value = condition.value.trim();
    if (!value) return 'Enter a comparison value for every condition.';
    if (value.length > OUTPUT_FLOW_VALUE_MAX_LENGTH) {
      return `Condition values must be ${OUTPUT_FLOW_VALUE_MAX_LENGTH} characters or fewer.`;
    }
    if (!templateIds.has(condition.templateId)) return 'Choose a saved template for every condition.';
  }

  return null;
}
