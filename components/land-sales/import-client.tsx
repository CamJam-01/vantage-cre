'use client';

import { useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Blueprint } from '@/components/ui/blueprint';
import { Button } from '@/components/ui/button';
import {
  csvHeaderError, downloadCsv, looksLikeWrongDelimiter,
  makeCsvTemplate, parseCsv, validateDataRows, type ImportRowResult,
} from '@/lib/land-sales/csv';
import { importLandSales, type ImportOutcome } from '@/app/(app)/land-sales/actions';

export function ImportLandSalesClient() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [rowResults, setRowResults] = useState<ImportRowResult[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);

  function reset() {
    setFileError(null);
    setRowResults(null);
    setOutcome(null);
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    reset();
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);

    const rows = parseCsv(text);
    if (rows.length === 0) {
      setFileError('The CSV is empty. Download the CSV template and use those headers.');
      return;
    }
    const hdrs = rows[0].map(h => h.trim());
    if (looksLikeWrongDelimiter(hdrs)) {
      setFileError('This file appears to use semicolons or tabs instead of commas. Re-export it as a comma-separated CSV and try again.');
      return;
    }
    const headerError = csvHeaderError(hdrs);
    if (headerError) {
      setFileError(headerError);
      return;
    }
    const dataRaw = rows.slice(1);
    if (dataRaw.length === 0) {
      setFileError('The CSV contains a header row but no data rows.');
      return;
    }

    setRowResults(validateDataRows(dataRaw));
  }

  async function handleImport(importNonDuplicates = false) {
    if (!csvText) return;
    setImporting(true);
    const result = await importLandSales(csvText, importNonDuplicates ? { importNonDuplicates: true } : undefined);
    setImporting(false);
    setOutcome(result);
  }

  function cancelDuplicates() {
    setOutcome(null);
    setCsvText(null);
    setRowResults(null);
    setFileName(null);
  }

  const rowErrors = rowResults?.filter(r => !r.ok).flatMap(r => (r.ok ? [] : r.errors)) ?? [];
  const rowWarnings = rowResults?.flatMap(r => (r.ok ? r.warnings ?? [] : [])) ?? [];
  const validRows = rowResults?.filter(r => r.ok) ?? [];
  const awaiting = Boolean(outcome?.awaitingConfirmation);
  const finished = Boolean(outcome && !outcome.awaitingConfirmation);
  const canImport = !!rowResults && rowErrors.length === 0 && validRows.length > 0 && !outcome;

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) calc(var(--space-8) * 3)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-100)',
    }}>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: '0 0 var(--space-2)' }}>
          Import Land Sales CSV
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: '0 0 var(--space-2)' }}>
          Use the template headers exactly. Table columns can only be added in Supabase, not from this import.
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: 0, marginBottom: 'var(--space-6)' }}
          onClick={() => downloadCsv('land-sales-import-template.csv', makeCsvTemplate())}
        >
          Download CSV template
        </button>

        <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', padding: 'var(--space-6)', background: 'var(--color-paper)' }}>
          <div className="field">
            <label htmlFor="csvFile">CSV file</label>
            <input id="csvFile" type="file" accept=".csv,text/csv" className="input" onChange={handleFile} />
          </div>

          {fileName && !fileError && !rowResults && !outcome && (
            <p style={{ fontSize: 13, color: 'var(--color-neutral-600)', marginTop: 'var(--space-3)' }}>Reading {fileName}…</p>
          )}

          {fileError && (
            <div className="record-error" style={{ marginTop: 'var(--space-4)' }}>{fileError}</div>
          )}

          {rowResults && rowErrors.length > 0 && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div className="tag tag-danger" style={{ marginBottom: 'var(--space-2)' }}>
                {rowErrors.length} error{rowErrors.length === 1 ? '' : 's'} — fix and re-upload
              </div>
              <ul className="record-error" style={{ margin: 0, paddingLeft: 18 }}>
                {rowErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          {rowResults && rowErrors.length === 0 && !outcome && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <p style={{ fontSize: 14, color: 'var(--color-text)' }}>
                {validRows.length} record{validRows.length === 1 ? '' : 's'} ready to import.
              </p>
              {rowWarnings.length > 0 && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div className="tag tag-warning" style={{ marginBottom: 'var(--space-2)' }}>
                    {rowWarnings.length} record{rowWarnings.length === 1 ? '' : 's'} flagged — unrecognized Sale Date, will still import
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--color-warning-700)' }}>
                    {rowWarnings.map((warn, i) => <li key={i}>{warn}</li>)}
                  </ul>
                </div>
              )}
              <Button type="button" variant="primary" onClick={() => handleImport(false)} disabled={!canImport || importing}>
                {importing ? 'Importing…' : `Import ${validRows.length} record${validRows.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          )}

          {awaiting && outcome && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div className="tag tag-warning" style={{ marginBottom: 'var(--space-2)' }}>
                {outcome.duplicates?.length} likely duplicate{outcome.duplicates?.length === 1 ? '' : 's'} — nothing has been inserted
              </div>
              <p style={{ fontSize: 14, color: 'var(--color-text)' }}>
                These rows look like records already in the database: {outcome.duplicates?.join(', ')}.
              </p>
              {outcome.freshCount ? (
                <p style={{ fontSize: 14, color: 'var(--color-text)' }}>
                  {outcome.freshCount} other row{outcome.freshCount === 1 ? '' : 's'} {outcome.freshCount === 1 ? 'is' : 'are'} new.
                </p>
              ) : (
                <p style={{ fontSize: 14, color: 'var(--color-text)' }}>
                  Every row in this file looks like a duplicate.
                </p>
              )}
              {outcome.warnings && outcome.warnings.length > 0 && (
                <ul style={{ margin: '0 0 var(--space-3)', paddingLeft: 18, fontSize: 13, color: 'var(--color-warning-700)' }}>
                  {outcome.warnings.map((warn, i) => <li key={i}>{warn}</li>)}
                </ul>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => handleImport(true)}
                  disabled={importing || !outcome.freshCount}
                >
                  {importing ? 'Importing…' : `Import ${outcome.freshCount ?? 0} non-duplicate${outcome.freshCount === 1 ? '' : 's'}`}
                </Button>
                <Button type="button" variant="secondary" onClick={cancelDuplicates} disabled={importing}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {finished && outcome && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              {outcome.headerError && <p className="record-error">{outcome.headerError}</p>}
              {outcome.rowErrors && outcome.rowErrors.length > 0 && (
                <ul className="record-error" style={{ margin: 0, paddingLeft: 18 }}>
                  {outcome.rowErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              )}
              {typeof outcome.inserted === 'number' && (
                <p style={{ fontSize: 14, color: 'var(--color-text)' }}>
                  Imported {outcome.inserted} record{outcome.inserted === 1 ? '' : 's'}.
                </p>
              )}
              {outcome.warnings && outcome.warnings.length > 0 && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div className="tag tag-warning" style={{ marginBottom: 'var(--space-2)' }}>
                    {outcome.warnings.length} record{outcome.warnings.length === 1 ? '' : 's'} flagged for review
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--color-warning-700)' }}>
                    {outcome.warnings.map((warn, i) => <li key={i}>{warn}</li>)}
                  </ul>
                </div>
              )}
              <Link href="/land-sales" className="btn btn-primary">Back to results</Link>
            </div>
          )}
        </Blueprint>
      </div>
    </main>
  );
}
