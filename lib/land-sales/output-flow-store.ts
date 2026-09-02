import type { SupabaseClient } from '@supabase/supabase-js';
import { costarColumnNames } from './costar-fields';
import { SALES_DATABASE_KEY, type DatabaseKey } from './field-visibility';
import {
  OUTPUT_FLOW_OPERATORS,
  type DocxOutputFlow,
  type OutputFlowCondition,
  type OutputFlowOperator,
} from './output-flows';

const OUTPUT_FLOW_SELECT = `
  id,
  name,
  default_template_id,
  updated_at,
  docx_output_flow_rules (
    id,
    field_name,
    operator,
    test_value,
    template_id,
    position
  )
`;

export class OutputFlowReadError extends Error {
  constructor(message: string) {
    super(`Could not load output flows: ${message}`);
    this.name = 'OutputFlowReadError';
  }
}

type OutputFlowRuleRow = {
  id: string;
  field_name: string;
  operator: string;
  test_value: string;
  template_id: string;
  position: number;
};

type OutputFlowRow = {
  id: string;
  name: string;
  default_template_id: string;
  updated_at: string;
  docx_output_flow_rules: OutputFlowRuleRow[] | null;
};

function isOperator(value: string): value is OutputFlowOperator {
  return OUTPUT_FLOW_OPERATORS.some(operator => operator === value);
}

const CATALOG_FIELDS = new Set(costarColumnNames());

function conditionFromRow(row: OutputFlowRuleRow): OutputFlowCondition | null {
  if (!isOperator(row.operator) || !CATALOG_FIELDS.has(row.field_name) || !row.test_value.trim()) {
    return null;
  }
  return {
    id: row.id,
    field: row.field_name,
    operator: row.operator,
    value: row.test_value,
    templateId: row.template_id,
    position: row.position,
  };
}

function outputFlowFromRow(row: OutputFlowRow): DocxOutputFlow {
  const conditions = (row.docx_output_flow_rules ?? [])
    .map(conditionFromRow)
    .filter((condition): condition is OutputFlowCondition => condition !== null)
    .sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    name: row.name,
    defaultTemplateId: row.default_template_id,
    updatedAt: row.updated_at,
    conditions,
  };
}

/** Output flows are the user-facing DOCX choices; their rules are loaded with
 * them so routing never depends on the results table's visible columns. */
export async function listDocxOutputFlows(
  supabase: SupabaseClient,
  databaseKey: DatabaseKey = SALES_DATABASE_KEY,
): Promise<DocxOutputFlow[]> {
  const { data, error } = await supabase
    .from('docx_output_flows')
    .select(OUTPUT_FLOW_SELECT)
    .eq('database_key', databaseKey)
    .order('name', { ascending: true });

  if (error) throw new OutputFlowReadError(error.message);
  return ((data ?? []) as unknown as OutputFlowRow[]).map(outputFlowFromRow);
}
