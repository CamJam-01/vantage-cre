import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { appFieldNames, COMMENTS_COLUMN, VERIFIED_BY_COLUMN } from './app-fields.ts';
import { resultColumns } from './result-columns.ts';
import { fieldDisplayRows, orderColumns } from './field-visibility.ts';
import { columnsFromFormData } from './schema.ts';
import { landSaleFromRow, landSaleToRow } from './db.ts';
import { mergeVisibleUpdate, sanitizeVisibleCreate } from './visible-record-input.ts';
import { csvHeaderError, makeCsv, parseCsv, validateDataRows } from './csv.ts';
import { costarHeaderRow } from './costar-fields.ts';
import { mergeTagCatalog, mergeValuesFromColumns } from './merge-tags.ts';
import { replaceMergeTags } from './docx-xml.ts';
import { decodeFilters, encodeFilters } from './search-params.ts';
import { decodeSort } from './results-sort.ts';

describe('approved app fields', () => {
  for (const pathId of ['land', 'improved'] as const) {
    it(`${pathId}: defaults Verified By after Comments without duplicating saved placements`, () => {
      const columns = resultColumns({ pathId });
      const names = appFieldNames(pathId);
      assert.equal(names[names.indexOf(COMMENTS_COLUMN) + 1], VERIFIED_BY_COLUMN);
      const saved = ['Sale Date', COMMENTS_COLUMN, 'Property Name'];
      assert.deepEqual(orderColumns(columns, saved).slice(0, 4).map(c => c.key),
        ['Sale Date', COMMENTS_COLUMN, VERIFIED_BY_COLUMN, 'Property Name']);
      assert.deepEqual(fieldDisplayRows(columns, saved).slice(0, 4).map(row => row.id),
        ['Sale Date', COMMENTS_COLUMN, VERIFIED_BY_COLUMN, 'Property Name']);
      const explicit = [VERIFIED_BY_COLUMN, 'Property Name', COMMENTS_COLUMN];
      assert.deepEqual(orderColumns(columns, explicit).slice(0, 3).map(c => c.key), explicit);
      assert.equal(fieldDisplayRows(columns, explicit).filter(row => row.id === VERIFIED_BY_COLUMN).length, 1);
    });

    it(`${pathId}: round-trips Comments in the exact CSV contract and excludes Verified By`, () => {
      const record = landSaleFromRow({ id: 'record', [COMMENTS_COLUMN]: 'Verified, with owner', [VERIFIED_BY_COLUMN]: 'Historical username' });
      assert.ok(record);
      const csv = makeCsv([record], pathId);
      const [headers, row] = parseCsv(csv);
      assert.equal(headers.join(','), costarHeaderRow(pathId));
      assert.equal(headers.includes('Comments'), false);
      assert.equal(headers.includes('Verified By'), false);
      assert.equal(headers.includes(VERIFIED_BY_COLUMN), false);
      assert.equal(csv.includes('Historical username'), false);
      assert.equal(csvHeaderError(headers, pathId), undefined);
      const [imported] = validateDataRows([row], pathId);
      assert.ok(imported.ok);
      assert.equal(imported.data.columns[COMMENTS_COLUMN], record.columns[COMMENTS_COLUMN]);
      assert.equal(Object.hasOwn(imported.data.columns, VERIFIED_BY_COLUMN), false);
      assert.equal(Object.hasOwn(landSaleToRow(imported.data), VERIFIED_BY_COLUMN), false);
      assert.equal(makeCsv([{ id: 'reimported', ...imported.data }], pathId), csv);
    });
  }

  it('persists custom text, permits clearing, and protects hidden values from crafted submissions', () => {
    const existing = landSaleFromRow({ id: 'record', [VERIFIED_BY_COLUMN]: 'Previous username' });
    assert.ok(existing);
    const form = new FormData();
    form.set(VERIFIED_BY_COLUMN, '  Outside appraiser  ');
    const submitted = columnsFromFormData(form, new Set());
    const update = mergeVisibleUpdate(existing, submitted, new Set());
    assert.equal(landSaleToRow(update)[VERIFIED_BY_COLUMN], 'Outside appraiser');
    assert.equal(landSaleToRow(sanitizeVisibleCreate(submitted, new Set()))[VERIFIED_BY_COLUMN], 'Outside appraiser');
    const hidden = new Set([VERIFIED_BY_COLUMN]);
    assert.equal(mergeVisibleUpdate(existing, submitted, hidden).columns[VERIFIED_BY_COLUMN], 'Previous username');
    assert.equal(Object.hasOwn(columnsFromFormData(form, hidden).columns, VERIFIED_BY_COLUMN), false);
    assert.equal(landSaleToRow(sanitizeVisibleCreate(submitted, hidden))[VERIFIED_BY_COLUMN], undefined);
    form.set(VERIFIED_BY_COLUMN, '');
    assert.equal(landSaleToRow(mergeVisibleUpdate(existing, columnsFromFormData(form, new Set()), new Set()))[VERIFIED_BY_COLUMN], null);
  });

  it('merges both new tags, including fragmented Word runs, without the retired tag alias', () => {
    const values = mergeValuesFromColumns({ [COMMENTS_COLUMN]: 'Owner & broker', [VERIFIED_BY_COLUMN]: 'Former username' });
    assert.equal(values.comments, 'Owner & broker');
    assert.equal(values.verified_by, 'Former username');
    assert.equal(Object.hasOwn(values, 'transaction_notes'), false);
    const catalog = mergeTagCatalog();
    assert.ok(catalog.some(tag => tag.header === 'Comments' && tag.name === 'comments'));
    assert.ok(catalog.some(tag => tag.header === 'Verified By' && tag.name === 'verified_by'));
    assert.equal(catalog.some(tag => tag.name === 'transaction_notes'), false);
    const xml = '<w:p><w:r><w:t>{{ com</w:t></w:r><w:r><w:t>ments }}</w:t></w:r><w:r><w:t> / {{ verified_</w:t></w:r><w:r><w:t>by }}</w:t></w:r></w:p>';
    const merged = replaceMergeTags(xml, values);
    assert.equal(merged.replace(/<[^>]+>/g, ''), 'Owner &amp; broker / Former username');
  });

  it('preserves Verified By filters in shareable URLs and permits sorting', () => {
    const filters = decodeFilters(new URLSearchParams(`ff=${encodeURIComponent(`${VERIFIED_BY_COLUMN}|text|Custom name`)}`));
    assert.deepEqual(filters.fieldFilters, [{ column: VERIFIED_BY_COLUMN, kind: 'text', contains: 'Custom name' }]);
    assert.deepEqual(decodeFilters(encodeFilters(filters)), filters);
    assert.deepEqual(decodeSort(VERIFIED_BY_COLUMN, 'desc'), { column: VERIFIED_BY_COLUMN, dir: 'desc' });
  });
});
