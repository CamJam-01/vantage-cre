'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MERGE_RECORD_LIMIT } from '@/lib/land-sales/docx-templates';
import type { DocxOutputFlow } from '@/lib/land-sales/output-flows';

/** Uses the filename the route handler chose, so the download is named after
 * the Output Flow rather than being renamed here. */
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
  outputFlows,
  recordIds,
}: {
  open: boolean;
  onClose: () => void;
  outputFlows: DocxOutputFlow[];
  recordIds: string[];
}) {
  const [chosenId, setChosenId] = useState('');
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived rather than synced in an effect: a flow deleted since this
  // dialog last opened simply falls back to the first one still listed.
  const flowId = outputFlows.some(flow => flow.id === chosenId) ? chosenId : outputFlows[0]?.id ?? '';
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
        body: JSON.stringify({ flowId, ids: recordIds }),
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

  const canMerge = Boolean(flowId) && recordIds.length > 0 && !overLimit && !merging;

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
        routed template body, all in a single document and in this selection order.
      </p>

      {outputFlows.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--color-text)', margin: 0 }}>
          No Output Flows have been set up yet. An admin can create one under{' '}
          <Link href="/admin/database-manager/templates?db=sales" className="btn btn-ghost" style={{ padding: 0 }}>
            Database Manager → Set templates
          </Link>
          .
        </p>
      ) : (
        <div className="field">
          <label htmlFor="mergeOutputFlow">Output</label>
          <select
            id="mergeOutputFlow"
            className="input"
            value={flowId}
            disabled={merging}
            onChange={event => setChosenId(event.target.value)}
            style={{ backgroundColor: 'var(--color-paper)', cursor: 'pointer' }}
          >
            {outputFlows.map(flow => (
              <option key={flow.id} value={flow.id}>{flow.name}</option>
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
