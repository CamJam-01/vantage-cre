'use client';

import { useMemo, useState, useTransition } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  deleteOutputFlowAction,
  saveOutputFlowAction,
  type TemplateActionState,
} from '@/app/(app)/admin/database-manager/templates/actions';
import type { DocxTemplate } from '@/lib/land-sales/docx-templates';
import {
  OUTPUT_FLOW_CONDITION_LIMIT,
  OUTPUT_FLOW_NAME_MAX_LENGTH,
  OUTPUT_FLOW_OPERATORS,
  OUTPUT_FLOW_OPERATOR_LABELS,
  OUTPUT_FLOW_VALUE_MAX_LENGTH,
  outputFlowDraftError,
  type DocxOutputFlow,
  type OutputFlowConditionDraft,
  type OutputFlowDraft,
} from '@/lib/land-sales/output-flows';

function draftFor(flow: DocxOutputFlow): OutputFlowDraft {
  return {
    id: flow.id,
    name: flow.name,
    defaultTemplateId: flow.defaultTemplateId,
    conditions: flow.conditions.map(condition => ({
      field: condition.field,
      operator: condition.operator,
      value: condition.value,
      templateId: condition.templateId,
    })),
  };
}

function emptyDraft(templates: DocxTemplate[]): OutputFlowDraft {
  return {
    id: null,
    name: '',
    defaultTemplateId: templates[0]?.id ?? '',
    conditions: [],
  };
}

function StatusNote({ state }: { state: TemplateActionState }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={state.status === 'error' ? 'record-error' : undefined}
      style={{
        margin: 'var(--space-3) 0 0',
        fontSize: 13,
        color: state.status === 'error' ? undefined : 'var(--color-accent-700)',
      }}
    >
      {state.message}
    </p>
  );
}

function FlowEditor({
  draft,
  templates,
  fields,
  pending,
  onChange,
  onCancel,
  onSave,
}: {
  draft: OutputFlowDraft;
  templates: DocxTemplate[];
  fields: string[];
  pending: boolean;
  onChange: (draft: OutputFlowDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const templateIds = useMemo(() => new Set(templates.map(template => template.id)), [templates]);
  const validationError = outputFlowDraftError(draft, templateIds);

  function updateCondition(index: number, patch: Partial<OutputFlowConditionDraft>) {
    onChange({
      ...draft,
      conditions: draft.conditions.map((condition, conditionIndex) =>
        conditionIndex === index ? { ...condition, ...patch } : condition,
      ),
    });
  }

  function addCondition() {
    const alternate = templates.find(template => template.id !== draft.defaultTemplateId) ?? templates[0];
    onChange({
      ...draft,
      conditions: [...draft.conditions, {
        field: fields.includes('Sale Status') ? 'Sale Status' : fields[0] ?? '',
        operator: 'does_not_equal',
        value: '',
        templateId: alternate?.id ?? '',
      }],
    });
  }

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        onSave();
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        border: '1px solid var(--color-neutral-300)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-4)' }}>
        <div className="field">
          <label htmlFor="outputFlowName">Output name</label>
          <input
            id="outputFlowName"
            className="input"
            value={draft.name}
            disabled={pending}
            maxLength={OUTPUT_FLOW_NAME_MAX_LENGTH}
            placeholder="e.g. Land Comps"
            onChange={event => onChange({ ...draft, name: event.target.value })}
            style={{ backgroundColor: 'var(--color-paper)' }}
          />
        </div>
        <div className="field">
          <label htmlFor="outputFlowDefault">Default template</label>
          <select
            id="outputFlowDefault"
            className="input"
            value={draft.defaultTemplateId}
            disabled={pending}
            onChange={event => onChange({ ...draft, defaultTemplateId: event.target.value })}
            style={{ backgroundColor: 'var(--color-paper)' }}
          >
            <option value="">Choose a template</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
          Conditions
        </div>
        {draft.conditions.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: 0 }}>
            No conditions. Every record will use the default template.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {draft.conditions.map((condition, index) => (
              <div
                key={`${draft.id ?? 'new'}-${index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(150px, 1fr) minmax(130px, 0.7fr) minmax(130px, 1fr) minmax(150px, 1fr) auto',
                  gap: 'var(--space-2)',
                  alignItems: 'end',
                }}
              >
                <div className="field">
                  <label htmlFor={`flowField-${index}`}>Field</label>
                  <select
                    id={`flowField-${index}`}
                    className="input"
                    value={condition.field}
                    disabled={pending}
                    onChange={event => updateCondition(index, { field: event.target.value })}
                    style={{ backgroundColor: 'var(--color-paper)' }}
                  >
                    {fields.map(field => <option key={field} value={field}>{field}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`flowOperator-${index}`}>Operator</label>
                  <select
                    id={`flowOperator-${index}`}
                    className="input"
                    value={condition.operator}
                    disabled={pending}
                    onChange={event => updateCondition(index, {
                      operator: event.target.value as OutputFlowConditionDraft['operator'],
                    })}
                    style={{ backgroundColor: 'var(--color-paper)' }}
                  >
                    {OUTPUT_FLOW_OPERATORS.map(operator => (
                      <option key={operator} value={operator}>{OUTPUT_FLOW_OPERATOR_LABELS[operator]}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`flowValue-${index}`}>Value</label>
                  <input
                    id={`flowValue-${index}`}
                    className="input"
                    value={condition.value}
                    disabled={pending}
                    maxLength={OUTPUT_FLOW_VALUE_MAX_LENGTH}
                    placeholder="e.g. Sold"
                    onChange={event => updateCondition(index, { value: event.target.value })}
                    style={{ backgroundColor: 'var(--color-paper)' }}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`flowTemplate-${index}`}>Use template</label>
                  <select
                    id={`flowTemplate-${index}`}
                    className="input"
                    value={condition.templateId}
                    disabled={pending}
                    onChange={event => updateCondition(index, { templateId: event.target.value })}
                    style={{ backgroundColor: 'var(--color-paper)' }}
                  >
                    <option value="">Choose a template</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pending}
                  aria-label={`Remove condition ${index + 1}`}
                  title="Remove condition"
                  onClick={() => onChange({
                    ...draft,
                    conditions: draft.conditions.filter((_, conditionIndex) => conditionIndex !== index),
                  })}
                >
                  <Trash2 size={16} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending || draft.conditions.length >= OUTPUT_FLOW_CONDITION_LIMIT || templates.length === 0}
          onClick={addCondition}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden />
          Add conditional
        </button>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={onCancel}>
            Cancel
          </button>
          <Button type="submit" variant="primary" disabled={pending || Boolean(validationError)}>
            {pending ? 'Saving…' : 'Save output flow'}
          </Button>
        </div>
      </div>
      {validationError && (
        <p className="record-error" style={{ margin: 0 }}>{validationError}</p>
      )}
    </form>
  );
}

export function OutputRouter({
  templates,
  flows,
  fields,
  loadError,
}: {
  templates: DocxTemplate[];
  flows: DocxOutputFlow[];
  fields: string[];
  loadError?: string;
}) {
  const [draft, setDraft] = useState<OutputFlowDraft | null>(null);
  const [status, setStatus] = useState<TemplateActionState>(null);
  const [deleting, setDeleting] = useState<DocxOutputFlow | null>(null);
  const [pending, startTransition] = useTransition();
  const templateNames = useMemo(
    () => new Map(templates.map(template => [template.id, template.name])),
    [templates],
  );

  function save() {
    if (!draft) return;
    startTransition(async () => {
      const result = await saveOutputFlowAction(draft);
      setStatus(result);
      if (result?.status === 'success') setDraft(null);
    });
  }

  function remove() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteOutputFlowAction(deleting.id);
      setStatus(result);
      if (result?.status === 'success') setDeleting(null);
    });
  }

  return (
    <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', padding: 'var(--space-6)', background: 'var(--color-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>
          Output Router
        </div>
        {!draft && (
          <Button
            type="button"
            variant="primary"
            disabled={templates.length === 0 || Boolean(loadError)}
            onClick={() => {
              setStatus(null);
              setDraft(emptyDraft(templates));
            }}
          >
            <Plus size={16} strokeWidth={1.5} aria-hidden />
            Create Output Flow
          </Button>
        )}
      </div>
      <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: '0 0 var(--space-4)' }}>
        Give users one output choice, then route each selected record to a saved template. Conditions
        run from top to bottom; the first match wins, and the default handles every other record.
        Build alternate templates from the same Word base; the default supplies shared styles,
        page setup, headers, and footers.
      </p>

      {loadError ? (
        <p className="record-error" style={{ margin: 0 }}>{loadError}</p>
      ) : draft ? (
        <FlowEditor
          draft={draft}
          templates={templates}
          fields={fields}
          pending={pending}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={save}
        />
      ) : flows.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: 0 }}>
          No Output Flows yet. Upload the needed templates, then create an output such as “Land Comps.”
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {flows.map(flow => (
            <div key={flow.id} style={{ borderTop: '1px solid var(--color-neutral-300)', paddingTop: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{flow.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
                    Default: {templateNames.get(flow.defaultTemplateId) ?? 'Unavailable template'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label={`Edit ${flow.name}`}
                    title="Edit output flow"
                    onClick={() => { setStatus(null); setDraft(draftFor(flow)); }}
                  >
                    <Pencil size={16} strokeWidth={1.5} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label={`Delete ${flow.name}`}
                    title="Delete output flow"
                    onClick={() => setDeleting(flow)}
                  >
                    <Trash2 size={16} strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
              </div>
              {flow.conditions.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-neutral-700)', margin: 'var(--space-2) 0 0' }}>
                  All records use the default template.
                </p>
              ) : (
                <ol style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-5)', fontSize: 13 }}>
                  {flow.conditions.map(condition => (
                    <li key={condition.id}>
                      {condition.field} {OUTPUT_FLOW_OPERATOR_LABELS[condition.operator]} “{condition.value}” →{' '}
                      {templateNames.get(condition.templateId) ?? 'Unavailable template'}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}
      <StatusNote state={status} />

      <Dialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete output flow"
        actions={
          <>
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <Button type="button" variant="primary" disabled={pending} onClick={remove}>
              {pending ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          Delete “{deleting?.name}”? It will no longer appear as a DOCX output choice.
        </p>
      </Dialog>
    </Blueprint>
  );
}
