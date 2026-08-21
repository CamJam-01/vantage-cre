'use client';

import { useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';
import { Button } from '@/components/ui/button';
import {
  csvFields, csvHeaders, downloadCsv, fieldForCanonicalHeader, fieldToHeader,
  headersMatchExactly, looksLikeWrongDelimiter, makeCsvTemplate, mappingIssues,
  missingRequiredTargets, parseCsv, REQUIRED_CSV_FIELDS, suggestSourceMapping,
  unmatchedHeaders, validateMappedRows, type CsvField, type ImportRowResult,
  type MappingAction, type SourceMapping,
} from '@/lib/land-sales/csv';
import { importLandSales, type ImportOutcome } from '@/app/(app)/land-sales/actions';

function actionFromSelect(value: string): MappingAction {
  if (value === '') return { type: 'skip' };
  if (value === 'new') return { type: 'new' };
  return { type: 'existing', field: value as CsvField };
}

function selectValue(action: MappingAction): string {
  switch (action.type) {
    case 'skip':
      return '';
    case 'new':
      return 'new';
    case 'existing':
      return action.field;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function ImportLandSalesClient() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [headers, setHeaders] = useState<string[] | null>(null);
  const [dataRowsRaw, setDataRowsRaw] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<SourceMapping | null>(null);
  const [selectedNewIndexes, setSelectedNewIndexes] = useState<Set<number>>(new Set());
  const [unmatchedStep, setUnmatchedStep] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);

  const [rowResults, setRowResults] = useState<ImportRowResult[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);

  const unmatched = headers ? unmatchedHeaders(headers) : [];

  function reset() {
    setFileError(null);
    setHeaders(null);
    setDataRowsRaw(null);
    setMapping(null);
    setSelectedNewIndexes(new Set());
    setUnmatchedStep(false);
    setShowMapping(false);
    setMappingError(null);
    setRowResults(null);
    setOutcome(null);
  }

  function validateWithMapping(dataRaw: string[][], hdrs: string[], m: SourceMapping) {
    setRowResults(validateMappedRows(dataRaw, hdrs, m));
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
      const m = suggestSourceMapping(hdrs);
      setMapping(m);
      validateWithMapping(dataRaw, hdrs, m);
      return;
    }

    if (unmatchedHeaders(hdrs).length > 0) {
      setUnmatchedStep(true);
      return;
    }

    const m = suggestSourceMapping(hdrs);
    setMapping(m);
    setShowMapping(true);
  }

  function toggleNewField(index: number) {
    setSelectedNewIndexes(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function continueToMapping() {
    if (!headers) return;
    setMapping(suggestSourceMapping(headers, selectedNewIndexes));
    setMappingError(null);
    setUnmatchedStep(false);
    setShowMapping(true);
  }

  function updateMapping(index: number, value: string) {
    setMapping(prev => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = actionFromSelect(value);
      return next;
    });
  }

  function confirmMapping() {
    if (!mapping || !dataRowsRaw || !headers) return;
    const issues = mappingIssues(mapping);
    if (issues.length) {
      setMappingError(issues.join(' '));
      return;
    }
    setMappingError(null);
    setShowMapping(false);
    validateWithMapping(dataRowsRaw, headers, mapping);
  }

  function backToUnmatched() {
    setShowMapping(false);
    setUnmatchedStep(true);
    setMappingError(null);
    setRowResults(null);
  }

  function openMapping() {
    setUnmatchedStep(false);
    setShowMapping(true);
    setOutcome(null);
  }

  async function handleImport() {
    if (!csvText || !mapping) return;
    setImporting(true);
    const result = await importLandSales(csvText, mapping);
    setImporting(false);
    if (result.needsMapping) {
      setHeaders(result.needsMapping.headers);
      setMapping(result.needsMapping.suggested);
      setShowMapping(true);
      setUnmatchedStep(false);
      setRowResults(null);
      return;
    }
    setOutcome(result);
  }

  const rowErrors = rowResults?.filter(r => !r.ok).flatMap(r => (r.ok ? [] : r.errors)) ?? [];
  const rowWarnings = rowResults?.flatMap(r => (r.ok ? r.warnings ?? [] : [])) ?? [];
  const validRows = rowResults?.filter(r => r.ok) ?? [];
  const canImport = !!rowResults && rowErrors.length === 0 && validRows.length > 0 && !outcome;
  const mappingReady = !unmatchedStep && !showMapping;
  const stillNeed = mapping ? missingRequiredTargets(mapping) : [];

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
          We&apos;ll match headers that already exist in the database. Extra columns can be added as custom fields, then each CSV column is mapped to a database field.
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

          {unmatchedStep && headers && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <p style={{ fontSize: 14, color: 'var(--color-text)', margin: '0 0 var(--space-3)' }}>
                These column headers don&apos;t match fields in the database. Select any you want to add as new custom fields. Unchecked columns can still be mapped to an existing field in the next step.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: 0 }}
                  onClick={() => setSelectedNewIndexes(new Set(unmatched.map(u => u.index)))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: 0 }}
                  onClick={() => setSelectedNewIndexes(new Set())}
                >
                  Select none
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {unmatched.map(({ index, header }) => (
                  <label
                    key={index}
                    className="radio"
                    style={{
                      gap: 'var(--space-2)', cursor: 'pointer',
                      padding: 'var(--space-2) 0',
                      borderBottom: '1px solid var(--color-neutral-200)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedNewIndexes.has(index)}
                      onChange={() => toggleNewField(index)}
                    />
                    <span style={{ fontSize: 14, color: 'var(--color-text)' }}>{header || `Column ${index + 1}`}</span>
                  </label>
                ))}
              </div>
              <Button type="button" variant="primary" style={{ marginTop: 'var(--space-4)' }} onClick={continueToMapping}>
                Continue to mapping
              </Button>
            </div>
          )}

          {showMapping && headers && mapping && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <p style={{ fontSize: 14, color: 'var(--color-text)', margin: '0 0 var(--space-3)' }}>
                Map each CSV column to a database field. Fields marked <span style={{ color: '#b3261e' }}>*</span> are required.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {headers.map((header, i) => {
                  const unmatchedColumn = !fieldForCanonicalHeader(header);
                  return (
                    <div
                      key={`${header}-${i}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 'var(--space-3)', padding: 'var(--space-2) 0',
                        borderBottom: '1px solid var(--color-neutral-200)',
                      }}
                    >
                      <label htmlFor={`map-col-${i}`} style={{ fontSize: 14, color: 'var(--color-text)' }}>
                        {header || `Column ${i + 1}`}
                      </label>
                      <select
                        id={`map-col-${i}`}
                        className="input"
                        style={{ width: 260, backgroundColor: '#FFFFFF' }}
                        value={selectValue(mapping[i] ?? { type: 'skip' })}
                        onChange={e => updateMapping(i, e.target.value)}
                      >
                        <option value="">— Not mapped —</option>
                        {unmatchedColumn && <option value="new">— Create new field —</option>}
                        {csvFields.map(field => (
                          <option key={field} value={field}>
                            {fieldToHeader[field]}
                            {REQUIRED_CSV_FIELDS.includes(field) ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
              {stillNeed.length > 0 && (
                <p style={{ fontSize: 13, color: 'var(--color-neutral-700)', margin: 'var(--space-3) 0 0' }}>
                  Still need: {stillNeed.join(', ')}.
                </p>
              )}
              {mappingError && <div style={{ marginTop: 'var(--space-3)', fontSize: 13, color: '#b3261e' }}>{mappingError}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <Button type="button" variant="primary" onClick={confirmMapping}>
                  Apply mapping
                </Button>
                {unmatched.length > 0 && (
                  <button type="button" className="btn btn-ghost" onClick={backToUnmatched}>
                    Back
                  </button>
                )}
              </div>
            </div>
          )}

          {rowResults && mappingReady && rowErrors.length > 0 && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div className="tag" style={{ background: '#fbe4e2', color: '#b3261e', marginBottom: 'var(--space-2)' }}>
                {rowErrors.length} error{rowErrors.length === 1 ? '' : 's'} — fix and re-upload
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#b3261e' }}>
                {rowErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
              {headers && (
                <button type="button" className="btn btn-ghost" style={{ padding: 0, marginTop: 'var(--space-3)' }} onClick={openMapping}>
                  Adjust column mapping
                </button>
              )}
            </div>
          )}

          {rowResults && mappingReady && rowErrors.length === 0 && !outcome && (
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
                  <button type="button" className="btn btn-ghost" onClick={openMapping}>
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

      <Link href="/admin/database-manager" className="blueprint" style={{
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
