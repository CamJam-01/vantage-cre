'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MERGE_RECORD_LIMIT } from '@/lib/land-sales/docx-templates';
import {
  tableOutputFlow,
  tableOutputFlowSetupMessage,
  type DocxOutputFlow,
} from '@/lib/land-sales/output-flows';
import type { SalesPath } from '@/lib/land-sales/sales-path';

/** Uses the filename the route handler chose, so the download is named after
 * the Output Flow rather than being renamed here. */
function filenameFrom(disposition: string | null, fallback: string): string {
  const match = disposition ? /filename="([^"]+)"/.exec(disposition) : null;
  return match ? match[1] : fallback;
}

function printFailureMessage(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return 'Could not print the selected records.';
}

export function MergeDocxDialog({
  open,
  onClose,
  path,
  outputFlows,
  recordIds,
}: {
  open: boolean;
  onClose: () => void;
  path: SalesPath;
  outputFlows: DocxOutputFlow[];
  recordIds: string[];
}) {
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flow = tableOutputFlow(outputFlows);
  const setupMessage = tableOutputFlowSetupMessage(outputFlows.length);
  const overLimit = recordIds.length > MERGE_RECORD_LIMIT;

  function close() {
    setError(null);
    onClose();
  }

  async function print() {
    setPrinting(true);
    setError(null);
    try {
      const response = await fetch(`${path.basePath}/merge-docx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: recordIds }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        setError(printFailureMessage(payload));
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFrom(response.headers.get('Content-Disposition'), 'print.docx');
      link.click();
      URL.revokeObjectURL(url);
      close();
    } catch {
      setError('Could not print the selected records.');
    } finally {
      setPrinting(false);
    }
  }

  const canPrint = Boolean(flow) && recordIds.length > 0 && !overLimit && !printing;

  return (
    <Dialog
      open={open}
      onClose={printing ? () => {} : close}
      title="Print"
      actions={
        <>
          <button type="button" className="btn btn-ghost" disabled={printing} onClick={close}>
            Cancel
          </button>
          <Button variant="primary" disabled={!canPrint} onClick={() => { void print(); }}>
            {printing ? 'Printing…' : 'Print'}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 14, color: 'var(--color-text)', margin: '0 0 var(--space-4)' }}>
        {recordIds.length} record{recordIds.length === 1 ? '' : 's'} selected.
      </p>

      {!flow && (
        <p style={{ fontSize: 14, color: 'var(--color-text)', margin: 0 }}>
          {outputFlows.length === 0 ? (
            <>
              No Output Flow is set up for this table yet. An admin can create one under{' '}
              <Link
                href={`/admin/database-manager/templates?db=${path.databaseKey}`}
                className="btn btn-ghost"
                style={{ padding: 0 }}
              >
                Database Manager → Set templates
              </Link>
              .
            </>
          ) : (
            <>
              {setupMessage}{' '}
              <Link
                href={`/admin/database-manager/templates?db=${path.databaseKey}`}
                className="btn btn-ghost"
                style={{ padding: 0 }}
              >
                Database Manager → Set templates
              </Link>
              .
            </>
          )}
        </p>
      )}

      {overLimit && (
        <p className="record-error" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
          Print up to {MERGE_RECORD_LIMIT} records at a time — {recordIds.length} are selected.
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
