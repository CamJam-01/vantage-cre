import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { DocxTemplateError, mergeDocx } from './docx-merge.ts';
import { mergeValuesFromColumns } from './merge-tags.ts';

/** Round-trips a real .docx package — zip in, zip out — so the parts that only
 * show up once XML meets OPC packaging are covered too. */

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

/** `{{ property_name }}` is deliberately fragmented across four runs — the
 * shape Word actually produces when a tag is typed and then edited. */
const DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>
<w:p><w:r w:rsidR="a"><w:t>Comp </w:t></w:r><w:r w:rsidR="b"><w:t>{{ prop</w:t></w:r><w:r w:rsidR="c"><w:t>erty_na</w:t></w:r><w:r w:rsidR="d"><w:t>me }}</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Sold for {{ sale_price }} on {{ sale_date }} in {{ property_city }}.</w:t></w:r></w:p>
<w:p><w:r><w:t>Zoning: {{ zoning }} / Buyer: {{ buyer_true_company }}.</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>{{ comp_id }}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p><w:r><w:t>{{ price_per_ac_land }} per acre</w:t></w:r></w:p>
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
</w:body></w:document>`;

const HEADER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr ${W}><w:p><w:r><w:t>{{ property_name }} — running header</w:t></w:r></w:p></w:hdr>`;

async function buildTemplate(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELS);
  zip.file('word/document.xml', DOCUMENT);
  zip.file('word/header1.xml', HEADER);
  zip.file('word/styles.xml', `<?xml version="1.0"?><w:styles ${W}/>`);
  return zip.generateAsync({ type: 'uint8array' });
}

const records: Record<string, unknown>[] = [
  {
    'Price Per AC Land': 250000,
    'Comp ID': 90210,
    'Property Name': 'Riverbend Tract',
    'Property City': 'Austin',
    'Sale Price': 1250000,
    'Land Area AC': 5,
    'Sale Date': '2025-08-14T00:00:00',
    'Zoning': 'AG-2 & PUD',
    'Buyer (True) Company': 'Acme Holdings',
  },
  {
    'Price Per AC Land': 245000,
    'Comp ID': 90211,
    'Property Name': 'Kestrel Flats',
    'Property City': 'Round Rock',
    'Sale Price': 980000,
    'Land Area AC': 4,
    'Sale Date': '2024-03-02T00:00:00',
    'Zoning': null,
    'Buyer (True) Company': '',
  },
];

describe('mergeDocx', () => {
  let merged: JSZip;
  let documentXml: string;
  let bodyText: string;

  before(async () => {
    const bytes = await mergeDocx(await buildTemplate(), records.map(mergeValuesFromColumns));
    merged = await JSZip.loadAsync(bytes);
    documentXml = await merged.file('word/document.xml')!.async('string');
    bodyText = documentXml.replace(/<[^>]+>/g, '');
  });

  it('returns a readable .docx package', () => {
    assert.equal(merged.file('word/document.xml') !== null, true);
  });

  it('carries every other part through untouched', async () => {
    assert.equal(await merged.file('word/styles.xml')!.async('string'), `<?xml version="1.0"?><w:styles ${W}/>`);
    assert.equal(await merged.file('[Content_Types].xml')!.async('string'), CONTENT_TYPES);
    assert.equal(await merged.file('_rels/.rels')!.async('string'), RELS);
  });

  it('fills a tag Word fragmented across runs', () => {
    assert.match(bodyText, /Comp Riverbend Tract/);
    assert.match(bodyText, /Comp Kestrel Flats/);
  });

  it('fills every record from its own values, in the order given', () => {
    assert.equal(bodyText.indexOf('Riverbend Tract') < bodyText.indexOf('Kestrel Flats'), true);
    assert.match(bodyText, /Sold for \$1,250,000 on 08\/14\/2025 in Austin\./);
    assert.match(bodyText, /Sold for \$980,000 on 03\/02\/2024 in Round Rock\./);
  });

  it('fills tags inside table cells', () => {
    // Comp ID merges as "90,210": values go through formatCatalogValue, which
    // groups any numeric column, so the document reads exactly as the results
    // table the records were selected from. Changing that is a format.ts
    // decision affecting both surfaces, not a merge-side special case.
    assert.match(bodyText, /90,210/);
    assert.match(bodyText, /90,211/);
  });

  it('fills a price column as currency', () => {
    assert.match(bodyText, /\$250,000 per acre/);
    assert.match(bodyText, /\$245,000 per acre/);
  });

  it('collapses blank fields to nothing', () => {
    assert.match(bodyText, /Zoning: {2}\/ Buyer: \./);
  });

  it('escapes values that would otherwise break the XML', () => {
    assert.match(documentXml, /AG-2 &amp; PUD/);
  });

  it('leaves no merge tag behind', () => {
    assert.equal(documentXml.includes('{{'), false);
  });

  it('separates records with one page break and keeps one sectPr', () => {
    assert.equal((documentXml.match(/w:type="page"/g) ?? []).length, records.length - 1);
    assert.equal((documentXml.match(/<w:sectPr/g) ?? []).length, 1);
  });

  it('fills a running header from the first record, since it spans the document', async () => {
    const headerXml = await merged.file('word/header1.xml')!.async('string');
    assert.equal(headerXml.replace(/<[^>]+>/g, '').trim(), 'Riverbend Tract — running header');
  });

  it('rejects a file that is not a .docx', async () => {
    await assert.rejects(
      () => mergeDocx(new TextEncoder().encode('not a zip at all'), [{}]),
      DocxTemplateError,
    );
  });

  it('rejects a zip with no Word document part', async () => {
    const notAWordFile = await new JSZip().file('hello.txt', 'hi').generateAsync({ type: 'uint8array' });
    await assert.rejects(() => mergeDocx(notAWordFile, [{}]), DocxTemplateError);
  });

  it('rejects a merge with no records', async () => {
    const template = await buildTemplate();
    await assert.rejects(() => mergeDocx(template, []), DocxTemplateError);
  });
});
