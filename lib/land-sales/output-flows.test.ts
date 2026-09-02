import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  outputFlowConditionMatches,
  outputFlowDraftError,
  resolveOutputTemplateId,
  type DocxOutputFlow,
  type OutputFlowDraft,
} from './output-flows.ts';

const flow: DocxOutputFlow = {
  id: 'flow-1',
  name: 'Land Comps',
  defaultTemplateId: 'sales-template',
  updatedAt: '2026-09-02T00:00:00Z',
  conditions: [
    {
      id: 'rule-1',
      field: 'Sale Status',
      operator: 'does_not_equal',
      value: 'Sold',
      templateId: 'listing-template',
      position: 0,
    },
  ],
};

describe('outputFlowConditionMatches', () => {
  it('compares text case-insensitively and ignores surrounding whitespace', () => {
    assert.equal(outputFlowConditionMatches({ operator: 'equals', value: ' Sold ' }, 'sold'), true);
    assert.equal(outputFlowConditionMatches({ operator: 'contains', value: 'under' }, 'Under Contract'), true);
    assert.equal(outputFlowConditionMatches({ operator: 'does_not_equal', value: 'Sold' }, 'Active'), true);
  });

  it('treats a blank record value as different from a nonblank test value', () => {
    assert.equal(outputFlowConditionMatches({ operator: 'does_not_equal', value: 'Sold' }, null), true);
  });
});

describe('resolveOutputTemplateId', () => {
  it('routes Sold records to the default and non-Sold records to Listings', () => {
    assert.equal(resolveOutputTemplateId(flow, { 'Sale Status': 'Sold' }), 'sales-template');
    assert.equal(resolveOutputTemplateId(flow, { 'Sale Status': 'For Sale' }), 'listing-template');
  });

  it('uses the first matching condition in configured order', () => {
    const unordered: DocxOutputFlow = {
      ...flow,
      conditions: [
        { ...flow.conditions[0], id: 'later', position: 2, templateId: 'later-template' },
        { ...flow.conditions[0], id: 'first', position: 1, templateId: 'first-template' },
      ],
    };
    assert.equal(resolveOutputTemplateId(unordered, { 'Sale Status': 'Active' }), 'first-template');
  });
});

describe('outputFlowDraftError', () => {
  const templates = new Set(['sales-template', 'listing-template']);
  const draft: OutputFlowDraft = {
    id: null,
    name: 'Land Comps',
    defaultTemplateId: 'sales-template',
    conditions: [{
      field: 'Sale Status',
      operator: 'does_not_equal',
      value: 'Sold',
      templateId: 'listing-template',
    }],
  };

  it('accepts the Land Comps routing example', () => {
    assert.equal(outputFlowDraftError(draft, templates), null);
  });

  it('rejects unknown fields and stale template references', () => {
    assert.match(outputFlowDraftError({
      ...draft,
      conditions: [{ ...draft.conditions[0], field: 'Invented Field' }],
    }, templates) ?? '', /valid database field/);
    assert.match(outputFlowDraftError({ ...draft, defaultTemplateId: 'missing' }, templates) ?? '', /default/);
  });
});
