import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COSTAR_HEADERS, IMPROVED_COSTAR_HEADERS, IMPROVED_COSTAR_HEADER_ROW,
  costarColumnNames, costarHeaders,
} from './costar-fields.ts';
import { costarColumnType } from './costar-column-types.ts';
import { csvCell, csvHeaderError, makeCsv, makeCsvTemplate, parseCsv, validateDataRows, importLandSaleRow } from './csv.ts';
import { landSaleFromRow } from './db.ts';
import { resultColumns } from './result-columns.ts';
import { orderColumns } from './field-visibility.ts';

const supplied = readFileSync(new URL('./fixtures/costar-improved-sales-template.csv', import.meta.url), 'utf8').trim();

describe('Improved CoStar sequence', () => {
  it('matches the supplied template and README Appendix B exactly', () => {
    assert.equal(IMPROVED_COSTAR_HEADER_ROW, supplied);
    const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const appendix = readme.slice(readme.indexOf('## Appendix B'));
    assert.equal(appendix.match(/```text\n([^\n]*)\n```/)?.[1], supplied);
    assert.equal(IMPROVED_COSTAR_HEADERS.length, 279);
    assert.equal(new Set(IMPROVED_COSTAR_HEADERS).size, 277);
    assert.deepEqual([...new Set(IMPROVED_COSTAR_HEADERS)].sort(), costarColumnNames().sort());
    const duplicates = IMPROVED_COSTAR_HEADERS.filter((header, i, headers) => headers.indexOf(header) !== i);
    assert.deepEqual(duplicates, ['Average Rental Rate Per kW', 'Sprinklers']);
  });

  it('validates each path against its own exact sequence', () => {
    assert.equal(csvHeaderError(parseCsv('\ufeff' + supplied)[0], 'improved'), undefined);
    assert.ok(csvHeaderError([...COSTAR_HEADERS], 'improved'));
    assert.ok(csvHeaderError([...IMPROVED_COSTAR_HEADERS], 'land'));
    const swapped = [...IMPROVED_COSTAR_HEADERS];
    [swapped[4], swapped[5]] = [swapped[5], swapped[4]];
    assert.ok(csvHeaderError(swapped, 'improved'));
    assert.ok(csvHeaderError([...IMPROVED_COSTAR_HEADERS, 'New Field'], 'improved'));
  });

  it('uses unique Improved headers for default display while honoring saved arrangements', () => {
    const columns = resultColumns({ pathId: 'improved' });
    assert.deepEqual(columns.map(column => column.key), costarColumnNames(IMPROVED_COSTAR_HEADERS));
    assert.equal(columns[4].key, 'Building SF');
    assert.equal(columns.length, 277);
    assert.equal(columns.filter(column => column.key === 'Average Rental Rate Per kW').length, 1);
    assert.equal(orderColumns(columns, ['Sale Date', 'Property Name'])[0].key, 'Sale Date');
  });

  it('downloads a 279-position template that re-imports as an empty record', () => {
    const [headers, data] = parseCsv(makeCsvTemplate('improved'));
    assert.equal(headers.join(','), supplied);
    assert.equal(data.length, 279);
    const [result] = validateDataRows([data], 'improved');
    assert.ok(result.ok);
    assert.ok(Object.values(result.data.columns).every(value => value === null));
  });

  it('preserves every catalog field through import, database mapping, export, and re-import in both paths', () => {
    for (const pathId of ['land', 'improved'] as const) {
      const headers = costarHeaders(pathId);
      const values = headers.map(header => {
        const kind = costarColumnType(header);
        switch (kind) {
          case 'number': return '123';
          case 'date': return '08/20/2026';
          case 'boolean': return 'Yes';
          case 'text': return `${header}, "quoted"\nsecond line`;
          default: {
            const _exhaustive: never = kind;
            return _exhaustive;
          }
        }
      });
      const csv = '\ufeff' + [headers.join(','), values.map(csvCell).join(',')].join('\r\n');
      const [parsedHeaders, data] = parseCsv(csv);
      assert.equal(csvHeaderError(parsedHeaders, pathId), undefined);
      const [imported] = validateDataRows([data], pathId);
      assert.ok(imported.ok);
      assert.equal(imported.warnings, undefined);
      const record = landSaleFromRow({ id: 'fixture-id', ...importLandSaleRow(imported) });
      assert.ok(record);
      const [exportedHeaders, exportedData] = parseCsv(makeCsv([record], pathId));
      assert.deepEqual(exportedHeaders, headers);
      assert.equal(exportedData.length, headers.length);
      const [reimported] = validateDataRows([exportedData], pathId);
      assert.ok(reimported.ok);
      assert.deepEqual(reimported.data, imported.data);
      assert.equal(reimported.warnings, undefined);
    }
  });

  it('warns on differing repeated values and repeats the last stored value on export', () => {
    const values = IMPROVED_COSTAR_HEADERS.map(() => '');
    for (const header of ['Average Rental Rate Per kW', 'Sprinklers']) {
      const positions = IMPROVED_COSTAR_HEADERS.flatMap((name, i) => name === header ? [i] : []);
      values[positions[0]] = 'first';
      values[positions[1]] = 'last';
    }
    const [imported] = validateDataRows([values], 'improved');
    assert.ok(imported.ok);
    assert.equal(imported.warnings?.length, 2);
    const record = landSaleFromRow({ id: 'fixture-id', ...importLandSaleRow(imported) });
    assert.ok(record);
    const [, exported] = parseCsv(makeCsv([record], 'improved'));
    for (const header of ['Average Rental Rate Per kW', 'Sprinklers']) {
      assert.equal(imported.data.columns[header], 'last');
      IMPROVED_COSTAR_HEADERS.forEach((name, i) => {
        if (name === header) assert.equal(exported[i], 'last');
      });
    }
  });

  it('round-trips an unrecognized Improved Sale Date without losing its source text', () => {
    const values = IMPROVED_COSTAR_HEADERS.map(header => header === 'Sale Date' ? 'sometime last spring' : '');
    const [imported] = validateDataRows([values], 'improved');
    assert.ok(imported.ok);
    assert.equal(imported.data.saleDateRaw, 'sometime last spring');
    const record = landSaleFromRow({ id: 'fixture-id', ...importLandSaleRow(imported) });
    assert.ok(record);
    const [, exported] = parseCsv(makeCsv([record], 'improved'));
    const [reimported] = validateDataRows([exported], 'improved');
    assert.ok(reimported.ok);
    assert.deepEqual(reimported.data, imported.data);
  });
});
