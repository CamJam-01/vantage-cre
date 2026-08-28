'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MERGE_RECORD_LIMIT, type DocxTemplate } from '@/lib/land-sales/docx-templates';

/** Uses the filename the route handler chose, so the download is named after
 * the template rather than being renamed here. */
function filenameFrom(disposition: string | null, fallback: string): string {
  const match = disposition ? /filename="([^"]+)"/.exec(disposition) : null;
  return match ? match[1] : fallback;
}

function mergeFailureMessage(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return 'Could not merge the selected records.';
}

export function MergeDocxDialog({
  open,
  onClose,
  templates,
  recordIds,
}: {
  open: boolean;
  onClose: () => void;
  templates: DocxTemplate[];
  recordIds: string[];
}) {
  const [chosenId, setChosenId] = useState('');
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived rather than synced in an effect: a template deleted since this
  // dialog last opened simply falls back to the first one still listed.
  const templateId = templates.some(t => t.id === chosenId) ? chosenId : templates[0]?.id ?? '';
  const overLimit = recordIds.length > MERGE_RECORD_LIMIT;

  function close() {
    setError(null);
    onClose();
  }

  async function merge() {
    setMerging(true);
    setError(null);
    try {
      const response = await fetch('/land-sales/merge-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, ids: recordIds }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        setError(mergeFailureMessage(payload));
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFrom(response.headers.get('Content-Disposition'), 'merge.docx');
      link.click();
      URL.revokeObjectURL(url);
      close();
    } catch {
      setError('Could not merge the selected records.');
    } finally {
      setMerging(false);
    }
  }

  const canMerge = Boolean(templateId) && recordIds.length > 0 && !overLimit && !merging;

  return (
    <Dialog
      open={open}
      onClose={merging ? () => {} : close}
      title="Merge to DOCX"
      actions={
        <>
          <button type="button" className="btn btn-ghost" disabled={merging} onClick={close}>
            Cancel
          </button>
          <Button variant="primary" disabled={!canMerge} onClick={() => { void merge(); }}>
            {merging ? 'Merging…' : 'Merge'}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 14, color: 'var(--color-text)', margin: '0 0 var(--space-4)' }}>
        {recordIds.length} record{recordIds.length === 1 ? '' : 's'} selected. Each one fills its own
        copy of the template, all in a single document.
      </p>

      {templates.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--color-text)', margin: 0 }}>
          No templates have been set up yet. An admin can add one under{' '}
          <Link href="/admin/database-manager/templates?db=sales" className="btn btn-ghost" style={{ padding: 0 }}>
            Database Manager → Set templates
          </Link>
          .
        </p>
      ) : (
        <div className="field">
          <label htmlFor="mergeTemplate">Template</label>
          <select
            id="mergeTemplate"
            className="input"
            value={templateId}
            disabled={merging}
            onChange={event => setChosenId(event.target.value)}
            style={{ backgroundColor: 'var(--color-paper)', cursor: 'pointer' }}
          >
            {templates.map(template => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </div>
      )}

      {overLimit && (
        <p className="record-error" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
          Merge up to {MERGE_RECORD_LIMIT} records at a time — {recordIds.length} are selected.
        </p>
      )}
      {error && (
        <p role="status" className="record-error" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
          {error}
        </p>
      )}
    </Dialog>
  );
}
