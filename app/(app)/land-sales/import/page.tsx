'use client';

import { useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';
import { Button } from '@/components/ui/button';
import {
  applyHeaderMapping, csvFields, csvHeaders, downloadCsv, headersMatchExactly,
  looksLikeWrongDelimiter, makeCsvTemplate, missingRequiredMappings, parseCsv, REQUIRED_CSV_FIELDS,
  suggestHeaderMapping, validateDataRows, type ColumnMapping, type CsvField, type ImportRowResult,
} from '@/lib/land-sales/csv';
import { importLandSales, type ImportOutcome } from '@/app/(app)/land-sales/actions';

export default function ImportLandSalesPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [headers, setHeaders] = useState<string[] | null>(null);
  const [dataRowsRaw, setDataRowsRaw] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);

  const [rowResults, setRowResults] = useState<ImportRowResult[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);

  function reset() {
    setFileError(null);
    setHeaders(null);
    setDataRowsRaw(null);
    setMapping(null);
    setShowMapping(false);
    setMappingError(null);
    setRowResults(null);
    setOutcome(null);
  }

  function validateWithMapping(dataRaw: string[][], m: ColumnMapping) {
    setRowResults(validateDataRows(applyHeaderMapping(dataRaw, m)));
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
      setFileError(`The CSV is empty. Add a header row: ${csvHeaders.join(', ')}.`);
      return;
    }
    const hdrs = rows[0].map(h => h.trim());
    if (looksLikeWrongDelimiter(hdrs)) {
      setFileError('This file appears to use semicolons or tabs instead of commas. Re-export it as a comma-separated CSV and try again.');
      return;
    }
    const dataRaw = rows.slice(1);
    if (dataRaw.length === 0) {
      setFileError('The CSV contains a header row but no data rows.');
      return;
    }

    setHeaders(hdrs);
    setDataRowsRaw(dataRaw);

    if (headersMatchExactly(hdrs)) {
      const m = suggestHeaderMapping(hdrs);
      setMapping(m);
      validateWithMapping(dataRaw, m);
    } else {
      setMapping(suggestHeaderMapping(hdrs));
      setShowMapping(true);
    }
  }

  function updateMapping(field: CsvField, value: string) {
    setMapping(prev => {
      const next = { ...(prev ?? {}) };
      if (value === '') delete next[field];
      else next[field] = Number(value);
      return next;
    });
  }

  function confirmMapping() {
    if (!mapping || !dataRowsRaw) return;
    const missing = missingRequiredMappings(mapping);
    if (missing.length) {
      setMappingError(`Map a column for: ${missing.join(', ')}.`);
      return;
    }
    setMappingError(null);
    setShowMapping(false);
    validateWithMapping(dataRowsRaw, mapping);
  }

  async function handleImport() {
    if (!csvText || !mapping) return;
    setImporting(true);
    const result = await importLandSales(csvText, mapping);
    setImporting(false);
    if (result.needsMapping) {
      // Defensive: the server disagreed with the client's read of the file (e.g. a stale mapping).
      setHeaders(result.needsMapping.headers);
      setMapping(result.needsMapping.suggested);
      setShowMapping(true);
      setRowResults(null);
      return;
    }
    setOutcome(result);
  }

  const rowErrors = rowResults?.filter(r => !r.ok).flatMap(r => (r.ok ? [] : r.errors)) ?? [];
  const rowWarnings = rowResults?.flatMap(r => (r.ok ? r.warnings ?? [] : [])) ?? [];
  const validRows = rowResults?.filter(r => r.ok) ?? [];
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
          We&apos;ll match your CSV headers automatically where we can. If they don&apos;t match {csvHeaders.join(', ')}, you&apos;ll be asked to map your columns to these fields.
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: 0, marginBottom: 'var(--space-6)' }}
          onClick={() => downloadCsv('land-sales-import-template.csv', makeCsvTemplate())}
        >
          Download CSV template
        </button>

        <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', padding: 'var(--space-6)', background: '#FFFFFF' }}>
          <div className="field">
            <label htmlFor="csvFile">CSV file</label>
            <input id="csvFile" type="file" accept=".csv,text/csv" className="input" onChange={handleFile} />
          </div>

          {fileName && !fileError && !headers && (
            <p style={{ fontSize: 13, color: 'var(--color-neutral-600)', marginTop: 'var(--space-3)' }}>Reading {fileName}…</p>
          )}

          {fileError && (
            <div style={{ marginTop: 'var(--space-4)', fontSize: 13, color: '#b3261e' }}>{fileError}</div>
          )}

          {showMapping && headers && mapping && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <p style={{ fontSize: 14, color: 'var(--color-text)', margin: '0 0 var(--space-3)' }}>
                Your CSV&apos;s headers don&apos;t match ours. Map each field below to a column from your file (fields marked <span style={{ color: '#b3261e' }}>*</span> are required).
              </p>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {csvFields.map((field, i) => (
                  <div
                    key={field}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 'var(--space-3)', padding: 'var(--space-2) 0',
                      borderBottom: '1px solid var(--color-neutral-200)',
                    }}
                  >
                    <label htmlFor={`map-${field}`} style={{ fontSize: 14, color: 'var(--color-text)' }}>
                      {csvHeaders[i]}
                      {REQUIRED_CSV_FIELDS.includes(field) && <span style={{ color: '#b3261e' }}> *</span>}
                    </label>
                    <select
                      id={`map-${field}`}
                      className="input"
                      style={{ width: 240, backgroundColor: '#FFFFFF' }}
                      value={mapping[field] ?? ''}
                      onChange={e => updateMapping(field, e.target.value)}
                    >
                      <option value="">— Not mapped —</option>
                      {headers.map((h, hi) => (
                        <option key={hi} value={hi}>{h || `Column ${hi + 1}`}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {mappingError && <div style={{ marginTop: 'var(--space-3)', fontSize: 13, color: '#b3261e' }}>{mappingError}</div>}
              <Button type="button" variant="primary" style={{ marginTop: 'var(--space-4)' }} onClick={confirmMapping}>
                Apply mapping
              </Button>
            </div>
          )}

          {rowResults && rowErrors.length > 0 && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div className="tag" style={{ background: '#fbe4e2', color: '#b3261e', marginBottom: 'var(--space-2)' }}>
                {rowErrors.length} error{rowErrors.length === 1 ? '' : 's'} — fix and re-upload
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#b3261e' }}>
                {rowErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
              {headers && (
                <button type="button" className="btn btn-ghost" style={{ padding: 0, marginTop: 'var(--space-3)' }} onClick={() => setShowMapping(true)}>
                  Adjust column mapping
                </button>
              )}
            </div>
          )}

          {rowResults && rowErrors.length === 0 && !outcome && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <p style={{ fontSize: 14, color: 'var(--color-text)' }}>
                {validRows.length} record{validRows.length === 1 ? '' : 's'} ready to import.
              </p>
              {rowWarnings.length > 0 && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div className="tag" style={{ background: '#fef3c7', color: '#92400e', marginBottom: 'var(--space-2)' }}>
                    {rowWarnings.length} record{rowWarnings.length === 1 ? '' : 's'} flagged — unrecognized Sale Date, will still import
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#92400e' }}>
                    {rowWarnings.map((warn, i) => <li key={i}>{warn}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <Button type="button" variant="primary" onClick={handleImport} disabled={!canImport || importing}>
                  {importing ? 'Importing…' : `Import ${validRows.length} record${validRows.length === 1 ? '' : 's'}`}
                </Button>
                {headers && (
                  <button type="button" className="btn btn-ghost" onClick={() => setShowMapping(true)}>
                    Adjust column mapping
                  </button>
                )}
              </div>
            </div>
          )}

          {outcome && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              {outcome.headerError && <p style={{ fontSize: 13, color: '#b3261e' }}>{outcome.headerError}</p>}
              {outcome.rowErrors && outcome.rowErrors.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#b3261e' }}>
                  {outcome.rowErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              )}
              {typeof outcome.inserted === 'number' && (
                <p style={{ fontSize: 14, color: 'var(--color-text)' }}>
                  Imported {outcome.inserted} record{outcome.inserted === 1 ? '' : 's'}.
                  {outcome.duplicates && outcome.duplicates.length > 0 && (
                    <> Skipped {outcome.duplicates.length} likely duplicate{outcome.duplicates.length === 1 ? '' : 's'}: {outcome.duplicates.join(', ')}.</>
                  )}
                </p>
              )}
              {outcome.warnings && outcome.warnings.length > 0 && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div className="tag" style={{ background: '#fef3c7', color: '#92400e', marginBottom: 'var(--space-2)' }}>
                    {outcome.warnings.length} record{outcome.warnings.length === 1 ? '' : 's'} flagged for review
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#92400e' }}>
                    {outcome.warnings.map((warn, i) => <li key={i}>{warn}</li>)}
                  </ul>
                </div>
              )}
              <Link href="/land-sales" className="btn btn-primary">Back to results</Link>
            </div>
          )}
        </Blueprint>
      </div>

      <Link href="/land-sales" className="blueprint" style={{
        position: 'fixed', bottom: 'var(--space-6)', left: 'var(--space-6)', display: 'flex',
        alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-6)',
        background: 'var(--color-bg)', color: 'var(--color-text)', boxShadow: 'var(--shadow-md)', textDecoration: 'none',
      }}>
        <ArrowLeft size={18} strokeWidth={2} />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, letterSpacing: '0.03em' }}>BACK</span>
      </Link>
    </main>
  );
}
