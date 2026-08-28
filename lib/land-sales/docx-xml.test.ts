import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  combineMergedDocuments,
  DocxStructureError,
  escapeXmlText,
  PAGE_BREAK_PARAGRAPH,
  replaceMergeTags,
  replaceMergeTagsInParagraph,
  splitDocumentBody,
  unescapeXmlText,
} from './docx-xml.ts';

/** Word writes a run as `<w:r><w:t>…</w:t></w:r>`; these helpers keep the
 * fixtures readable while staying faithful to that shape. */
function run(text: string, attrs = ''): string {
  return `<w:r><w:t${attrs}>${text}</w:t></w:r>`;
}
function paragraph(...runs: string[]): string {
  return `<w:p>${runs.join('')}</w:p>`;
}
function documentXml(body: string, sectPr = '<w:sectPr><w:pgSz w:w="12240"/></w:sectPr>'): string {
  return `<?xml version="1.0"?><w:document xmlns:w="ns"><w:body>${body}${sectPr}</w:body></w:document>`;
}

const values = {
  comp_id: '90210',
  property_name: 'Riverbend Tract',
  sale_price: '$1,250,000',
  buyer_true_company: '',
  zoning: 'Smith & Sons <AG-2>',
};

describe('escapeXmlText / unescapeXmlText', () => {
  it('escapes the characters that would break the markup', () => {
    assert.equal(escapeXmlText('Smith & Sons <AG-2>'), 'Smith &amp; Sons &lt;AG-2&gt;');
  });

  it('round-trips entities Word may have written', () => {
    assert.equal(unescapeXmlText('Smith &amp; Sons &lt;AG-2&gt; &quot;x&quot; &#65;'), 'Smith & Sons <AG-2> "x" A');
  });
});

describe('replaceMergeTagsInParagraph', () => {
  it('fills a tag contained in a single run', () => {
    const result = replaceMergeTagsInParagraph(paragraph(run('Comp {{ comp_id }}.')), values);
    assert.match(result, />Comp 90210\.</);
  });

  it('fills a tag Word split across several runs', () => {
    // This is the normal case, not an edge case: spell-check and revision ids
    // routinely fragment a typed tag like this.
    const split = paragraph(run('{{ comp'), run('_id '), run('}} sold'));
    const result = replaceMergeTagsInParagraph(split, values);
    assert.match(result, />90210</);
    assert.match(result, />\s*sold</);
    assert.equal(result.includes('{{'), false);
  });

  it('keeps the run that opened the tag, and empties the ones it spilled into', () => {
    const split = paragraph(run('{{ comp', ' w:rsid="a"'), run('_id }}', ' w:rsid="b"'));
    const result = replaceMergeTagsInParagraph(split, values);
    assert.match(result, /w:rsid="a"[^>]*>90210</);
    assert.match(result, /w:rsid="b"[^>]*><\/w:t>/);
  });

  it('fills several tags in one paragraph', () => {
    const result = replaceMergeTagsInParagraph(
      paragraph(run('{{ property_name }} — {{ sale_price }}')),
      values,
    );
    assert.match(result, />Riverbend Tract — \$1,250,000</);
  });

  it('merges an empty field as nothing, closing the sentence up', () => {
    const result = replaceMergeTagsInParagraph(
      paragraph(run('Buyer: {{ buyer_true_company }}.')),
      values,
    );
    assert.match(result, />Buyer: \.</);
  });

  it('escapes XML-significant characters in merged values', () => {
    const result = replaceMergeTagsInParagraph(paragraph(run('{{ zoning }}')), values);
    assert.match(result, />Smith &amp; Sons &lt;AG-2&gt;</);
  });

  it('leaves an unknown tag in place so the typo is visible', () => {
    const result = replaceMergeTagsInParagraph(paragraph(run('{{ not_a_field }}')), values);
    assert.match(result, />\{\{ not_a_field \}\}</);
  });

  it('accepts the tag with or without inner spaces, and any casing', () => {
    for (const written of ['{{comp_id}}', '{{  comp_id  }}', '{{ COMP_ID }}']) {
      assert.match(replaceMergeTagsInParagraph(paragraph(run(written)), values), />90210</);
    }
  });

  it('does not read tag names off Object.prototype', () => {
    const result = replaceMergeTagsInParagraph(paragraph(run('{{ constructor }}')), values);
    assert.match(result, />\{\{ constructor \}\}</);
  });

  it('adds xml:space="preserve" so a merged value keeps its spacing', () => {
    const result = replaceMergeTagsInParagraph(paragraph(run('{{ property_name }} ')), values);
    assert.match(result, /xml:space="preserve"/);
  });

  it('returns the paragraph untouched when it holds no tag', () => {
    const plain = paragraph(run('Just prose.'));
    assert.equal(replaceMergeTagsInParagraph(plain, values), plain);
  });
});

describe('replaceMergeTags', () => {
  it('fills tags inside table cells as well as body paragraphs', () => {
    const xml = `<w:tbl><w:tr><w:tc>${paragraph(run('{{ comp_id }}'))}</w:tc></w:tr></w:tbl>`;
    assert.match(replaceMergeTags(xml, values), />90210</);
  });

  it('does not mistake paragraph properties for a paragraph', () => {
    const xml = `<w:p><w:pPr><w:pStyle w:val="Body"/></w:pPr>${run('{{ comp_id }}')}</w:p>`;
    const result = replaceMergeTags(xml, values);
    assert.match(result, /<w:pStyle w:val="Body"\/>/);
    assert.match(result, />90210</);
  });
});

describe('splitDocumentBody', () => {
  it('holds the body-level section properties aside', () => {
    const { content, sectPr } = splitDocumentBody(documentXml(paragraph(run('x'))));
    assert.equal(content, paragraph(run('x')));
    assert.equal(sectPr, '<w:sectPr><w:pgSz w:w="12240"/></w:sectPr>');
  });

  it('treats a sectPr nested in a paragraph as repeating content', () => {
    const inner = '<w:p><w:pPr><w:sectPr><w:type w:val="nextPage"/></w:sectPr></w:pPr></w:p>';
    const { content, sectPr } = splitDocumentBody(documentXml(inner, ''));
    assert.equal(content, inner);
    assert.equal(sectPr, '');
  });

  it('rejects a file with no Word body', () => {
    assert.throws(() => splitDocumentBody('<html><body>nope</body></html>'), DocxStructureError);
  });
});

describe('combineMergedDocuments', () => {
  const template = documentXml(paragraph(run('{{ property_name }}: {{ sale_price }}')));

  it('repeats the body once per record, each filled from its own values', () => {
    const merged = combineMergedDocuments(template, [
      values,
      { ...values, property_name: 'Kestrel Flats', sale_price: '$980,000' },
    ]);
    assert.match(merged, />Riverbend Tract: \$1,250,000</);
    assert.match(merged, />Kestrel Flats: \$980,000</);
  });

  it('separates records with a page break', () => {
    const merged = combineMergedDocuments(template, [values, values]);
    assert.equal(merged.split(PAGE_BREAK_PARAGRAPH).length - 1, 1);
  });

  it('adds no page break for a single record', () => {
    assert.equal(combineMergedDocuments(template, [values]).includes(PAGE_BREAK_PARAGRAPH), false);
  });

  it('keeps the section properties exactly once, at the end of the body', () => {
    const merged = combineMergedDocuments(template, [values, values, values]);
    assert.equal(merged.split('<w:sectPr>').length - 1, 1);
    assert.match(merged, /<\/w:sectPr><\/w:body><\/w:document>$/);
  });

  it('preserves the XML declaration and document element', () => {
    const merged = combineMergedDocuments(template, [values]);
    assert.match(merged, /^<\?xml version="1\.0"\?><w:document xmlns:w="ns"><w:body>/);
  });
});
