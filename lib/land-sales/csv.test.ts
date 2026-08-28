import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COSTAR_HEADER_ROW, COSTAR_HEADERS } from './costar-fields.ts';
import {
  csvHeaderError, csvHeaders, importLandSaleRow, makeCsv, makeCsvTemplate,
  parseCsv, recordKey, RECORD_KEY_COLUMNS, splitFreshAndDuplicates, validateDataRows,
} from './csv.ts';
import { SALE_DATE_RAW_COLUMN } from './costar-fields.ts';
import type { LandSale } from './schema.ts';
import { projectVisibleLandSale } from './db.ts';

function blankCostarRow(): string[] {
  return COSTAR_HEADERS.map(() => '');
}

function costarRow(values: Record<string, string>): string[] {
  const row = blankCostarRow();
  for (const [header, value] of Object.entries(values)) {
    const index = COSTAR_HEADERS.indexOf(header);
    assert.notEqual(index, -1, `unknown CoStar header: ${header}`);
    row[index] = value;
  }
  return row;
}

function record(columns: Record<string, unknown>, extras: Partial<LandSale> = {}): LandSale {
  return { id: extras.id ?? '1', columns, saleDateRaw: extras.saleDateRaw };
}

describe('csvHeaderError', () => {
  it('accepts the CoStar import template headers regardless of case or surrounding space', () => {
    const headers = [...COSTAR_HEADERS];
    headers[0] = '  property address';
    headers[1] = 'PROPERTY CITY';
    assert.equal(csvHeaderError(headers), undefined);
  });

  it('rejects extra columns instead of turning them into custom fields', () => {
    const error = csvHeaderError([...COSTAR_HEADERS, 'Zoning Extra']);
    assert.equal(typeof error, 'string');
    assert.match(error as string, /template/i);
    assert.doesNotMatch(error as string, /map|custom field|new field/i);
  });

  it('rejects renamed headers instead of offering a mapping step', () => {
    const headers = ['Property Address', 'City', ...COSTAR_HEADERS.slice(2)];
    const error = csvHeaderError(headers);
    assert.equal(typeof error, 'string');
    assert.match(error as string, /template/i);
    assert.doesNotMatch(error as string, /map|custom field|new field/i);
  });
});

describe('makeCsvTemplate', () => {
  it('includes a blank data row so the template itself can import', () => {
    const rows = makeCsvTemplate().split('\r\n');
    assert.equal(rows[0], COSTAR_HEADER_ROW);
    assert.equal(rows[0], csvHeaders.join(','));
    assert.equal(rows[0], COSTAR_HEADERS.join(','));
    assert.equal(rows[1], COSTAR_HEADERS.map(() => '').join(','));
  });

  it('never lists a system column in the template header', () => {
    assert.equal(COSTAR_HEADERS.includes('id'), false);
    assert.equal(COSTAR_HEADERS.includes(SALE_DATE_RAW_COLUMN), false);
  });
});

describe('validateDataRows', () => {
  it('accepts a row with every cell blank', () => {
    const results = validateDataRows([blankCostarRow()]);
    assert.equal(results[0].ok, true);
    if (results[0].ok) {
      assert.equal(results[0].data.columns['Property City'], null);
      assert.equal(results[0].data.columns['Property State'], null);
      assert.equal(results[0].columns['Property Address'], null);
    }
  });

  it('coerces typed cells onto exact header columns', () => {
    const results = validateDataRows([costarRow({
      'Property Address': '123 Main St',
      'Property City': 'Wendell',
      'Property State': 'NC',
      'Sale Price': '$1,000',
      'Buyer (True) Company': 'Acme LLC',
      'Parcel Number 1 (Min)': 'PIN-1',
    })]);
    assert.equal(results[0].ok, true);
    if (results[0].ok) {
      assert.equal(results[0].data.columns['Property Address'], '123 Main St');
      assert.equal(results[0].data.columns['Property City'], 'Wendell');
      assert.equal(results[0].data.columns['Property State'], 'NC');
      assert.equal(results[0].data.columns['Sale Price'], 1000);
      assert.equal(results[0].data.columns['Buyer (True) Company'], 'Acme LLC');
      assert.equal(results[0].data.columns['Parcel Number 1 (Min)'], 'PIN-1');
      assert.equal(results[0].columns['Sale Price'], '$1,000');
    }
  });

  it('imports onto CoStar columns without prototype identifiers', () => {
    const results = validateDataRows([costarRow({
      'Property Address': '123 Main St',
      'Property State': 'North Carolina',
      'Sale Price': '$1,000',
      'Land Area AC': '2.5',
    })]);
    assert.equal(results[0].ok, true);
    if (!results[0].ok) return;
    const inserted = importLandSaleRow(results[0]);
    assert.equal('parcel_id' in inserted, false);
    assert.equal('address' in inserted, false);
    assert.equal(inserted['Property Address'], '123 Main St');
    assert.equal(inserted['Property State'], 'North Carolina');
    assert.equal(inserted['Sale Price'], 1000);
    assert.equal(inserted['Land Area AC'], 2.5);
  });

  it('keeps a non-code Property State on the CoStar column without failing the row', () => {
    const results = validateDataRows([costarRow({ 'Property State': 'North Carolina' })]);
    assert.equal(results[0].ok, true);
    if (results[0].ok) {
      assert.equal(results[0].data.columns['Property State'], 'North Carolina');
      assert.equal(results[0].columns['Property State'], 'North Carolina');
    }
  });

  it('accepts Sale Date values with a trailing Excel/CoStar timestamp', () => {
    const results = validateDataRows([costarRow({ 'Sale Date': '8/13/2026 0:00' })]);
    assert.equal(results[0].ok, true);
    if (results[0].ok) {
      assert.equal(results[0].data.columns['Sale Date'], '2026-08-13');
      assert.equal(results[0].data.saleDateRaw, undefined);
      assert.equal(results[0].warnings, undefined);
    }
  });

  it('preserves unrecognized Sale Date text and warns instead of rejecting', () => {
    const results = validateDataRows([costarRow({ 'Sale Date': 'sometime last spring' })]);
    assert.equal(results[0].ok, true);
    if (!results[0].ok) return;
    assert.equal(results[0].data.columns['Sale Date'], null);
    assert.equal(results[0].data.saleDateRaw, 'sometime last spring');
    assert.ok(results[0].warnings?.[0]?.includes('sometime last spring'));
    const inserted = importLandSaleRow(results[0]);
    assert.equal(inserted[SALE_DATE_RAW_COLUMN], 'sometime last spring');
    assert.equal(inserted['Sale Date'], null);
  });
});

describe('recordKey / splitFreshAndDuplicates', () => {
  it('keys on Parcel Number 1 (Min), Sale Date, and Property Address', () => {
    assert.equal(
      recordKey({
        'Parcel Number 1 (Min)': 'PIN-1',
        'Sale Date': '2026-07-31T00:00:00',
        'Property Address': '123 Main St',
      }),
      'pin-1|2026-07-31|123 main st',
    );
  });

  it('names three catalog headers and no others', () => {
    assert.equal(RECORD_KEY_COLUMNS.length, 3);
    for (const name of RECORD_KEY_COLUMNS) {
      assert.equal(COSTAR_HEADERS.includes(name), true, `${name} is not a catalog header`);
    }
    const onlyKey = {
      'Parcel Number 1 (Min)': 'PIN-1',
      'Sale Date': '2026-07-31',
      'Property Address': '123 Main St',
    };
    assert.equal(recordKey({ ...onlyKey, Zoning: 'RA' }), recordKey(onlyKey));
  });

  it('separates fresh rows from duplicates without inserting either', () => {
    const existing = new Set(['pin-1|2026-07-31|123 main st']);
    const { fresh, duplicates } = splitFreshAndDuplicates([
      { columns: { 'Parcel Number 1 (Min)': 'PIN-1', 'Sale Date': '2026-07-31', 'Property Address': '123 Main St' }, label: 'PIN-1' },
      { columns: { 'Parcel Number 1 (Min)': 'PIN-2', 'Sale Date': '2026-08-01', 'Property Address': '9 Pine' }, label: 'PIN-2' },
    ], existing);
    assert.deepEqual(duplicates, ['PIN-1']);
    assert.equal(fresh.length, 1);
    assert.equal(fresh[0]['Parcel Number 1 (Min)'], 'PIN-2');
  });
});

describe('makeCsv', () => {
  it('writes the exact CoStar template header row', () => {
    const header = makeCsv([]).split('\r\n')[0];
    assert.equal(header, COSTAR_HEADER_ROW);
    assert.equal(csvHeaderError(header.split(',')), undefined);
  });

  it('emits all 278 positions in canonical order regardless of which fields are populated', () => {
    const csv = makeCsv([record({ Zoning: 'RA' })]);
    const [headerRow, dataRow] = parseCsv(csv);
    assert.equal(headerRow.length, 278);
    assert.equal(headerRow.join(','), COSTAR_HEADER_ROW);
    assert.equal(dataRow.length, 278);
    const values = Object.fromEntries(headerRow.map((name, index) => [name, dataRow[index] ?? '']));
    assert.equal(values.Zoning, 'RA');
    assert.equal(values['Property Address'], '');
    assert.equal(headerRow.includes('id'), false);
    assert.equal(headerRow.includes(SALE_DATE_RAW_COLUMN), false);
  });

  it('re-emits unrecognized Sale Date text so the row round-trips', () => {
    const csv = makeCsv([record({ 'Sale Date': null }, { saleDateRaw: 'sometime last spring' })]);
    const [, dataRow] = parseCsv(csv);
    const dateIndex = COSTAR_HEADERS.indexOf('Sale Date');
    assert.equal(dataRow[dateIndex], 'sometime last spring');
  });

  it('writes populated catalog values into the matching header positions', () => {
    const csv = makeCsv([record({
      'Property Address': '1012 Poinsettia Ln',
      'Property City': 'Wendell',
      'Property State': 'NC',
      'Property Type': 'Land',
      'Land Area AC': 1.5,
      'Sale Price': 485000,
      'Sale Date': '2026-07-31',
      Zoning: 'RA',
      Market: 'Raleigh, NC',
      'Parcel Number 1 (Min)': 'PIN-1',
    })]);
    const [headerRow, dataRow] = parseCsv(csv);
    const values = Object.fromEntries(headerRow.map((name, index) => [name, dataRow[index] ?? '']));
    assert.equal(values['Property Address'], '1012 Poinsettia Ln');
    assert.equal(values['Property City'], 'Wendell');
    assert.equal(values['Land Area AC'], '1.5');
    assert.equal(values['Sale Date'], '2026-07-31');
    assert.equal(values.Zoning, 'RA');
  });

  it('round-trips a hidden catalog value: export still emits it and re-import restores it', () => {
    const original = record({
      'Property Address': '9 Hidden St',
      'Parcel Number 1 (Min)': 'PIN-H',
      'Sale Date': '2026-01-02',
      Zoning: 'RA',
    });
    const visible = projectVisibleLandSale(original, new Set(['Property Address', 'Sale Date']));
    assert.equal('Zoning' in visible.columns, false);
    const csv = makeCsv([original]);
    const rows = parseCsv(csv);
    const validated = validateDataRows(rows.slice(1));
    assert.equal(validated[0]?.ok, true);
    if (!validated[0] || !validated[0].ok) return;
    const imported = importLandSaleRow(validated[0]);
    assert.equal(imported.Zoning, 'RA');
    assert.equal(imported['Property Address'], '9 Hidden St');
  });
});
