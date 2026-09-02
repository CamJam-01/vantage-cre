import { MERGE_TAG_PATTERN } from './merge-tags';

/** WordprocessingML surgery for the merge. A .docx is a zip of XML parts; this
 * module owns the string work on `word/document.xml` (and headers/footers) and
 * knows nothing about zips or Supabase, so it can be tested directly.
 *
 * The hard part is that Word does not store a paragraph's text as one string.
 * Typing `{{ comp_id }}` routinely lands as several `<w:r><w:t>` runs — split
 * by spell-check state, revision ids, or a stray formatting change — so a
 * naive replace over the raw XML finds nothing. Everything below works on a
 * paragraph's *concatenated* text and writes each result back into the run
 * where its tag started, which keeps that run's formatting and drops the
 * fragments the tag spilled into. */

/** Matches `<w:t>text</w:t>` and the self-closing `<w:t/>`. */
const TEXT_ELEMENT_PATTERN = /<w:t(\s[^>]*)?(?:\/>|>([\s\S]*?)<\/w:t>)/g;

/** Matches one whole paragraph. `<w:pPr>`/`<w:pStyle>` cannot match: the
 * character after `<w:p` must be whitespace, `>` or `/`. */
const PARAGRAPH_PATTERN = /<w:p(?:\s[^>]*)?(?:\/>|>[\s\S]*?<\/w:p>)/g;

export const PAGE_BREAK_PARAGRAPH = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

export function escapeXmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function unescapeXmlText(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

/** A merged value goes into a single `<w:t>`, which cannot hold a line break —
 * `<w:br/>` is a sibling element. Rather than restructure the run, multi-line
 * values (free-text columns like Transaction Notes) collapse to one line. */
function singleLine(value: string): string {
  return value.replace(/\s*[\r\n]+\s*/g, ' ');
}

type TextElement = { start: number; end: number; attrs: string; text: string };

function textElements(paragraph: string): TextElement[] {
  const elements: TextElement[] = [];
  for (const match of paragraph.matchAll(TEXT_ELEMENT_PATTERN)) {
    elements.push({
      start: match.index,
      end: match.index + match[0].length,
      attrs: match[1] ?? '',
      text: unescapeXmlText(match[2] ?? ''),
    });
  }
  return elements;
}

function renderTextElement(attrs: string, text: string): string {
  // Word trims leading/trailing whitespace unless the run opts out, and a
  // merged value regularly ends up adjacent to one (". {{ city }}, {{ state }}").
  const preserved = /\bxml:space\s*=/.test(attrs) ? attrs : `${attrs} xml:space="preserve"`;
  return `<w:t${preserved}>${escapeXmlText(text)}</w:t>`;
}

/** Replaces every tag in one paragraph. Unknown tag names are left as written
 * so a typo is visible in the output rather than silently blanking. */
export function replaceMergeTagsInParagraph(
  paragraph: string,
  values: Readonly<Record<string, string>>,
): string {
  const elements = textElements(paragraph);
  if (elements.length === 0) return paragraph;

  const combined = elements.map(element => element.text).join('');
  if (!combined.includes('{{')) return paragraph;

  // owner[i] is the index of the <w:t> that character i of `combined` came from.
  const owner: number[] = [];
  elements.forEach((element, index) => {
    for (let i = 0; i < element.text.length; i += 1) owner.push(index);
  });

  const matches = [...combined.matchAll(MERGE_TAG_PATTERN)];
  if (matches.length === 0) return paragraph;

  const outputs = elements.map(() => '');
  let cursor = 0;
  let replaced = false;

  for (const match of matches) {
    const start = match.index;
    const end = start + match[0].length;
    for (let i = cursor; i < start; i += 1) outputs[owner[i]] += combined[i];

    const name = match[1].toLowerCase();
    // Own-property only: `{{ constructor }}` must read as an unknown tag, not
    // as something inherited from Object.prototype.
    const value = Object.prototype.hasOwnProperty.call(values, name) ? values[name] : undefined;
    if (typeof value !== 'string') {
      // Not a known field — copy the tag through untouched.
      for (let i = start; i < end; i += 1) outputs[owner[i]] += combined[i];
    } else {
      outputs[owner[start]] += singleLine(value);
      replaced = true;
    }
    cursor = end;
  }
  for (let i = cursor; i < combined.length; i += 1) outputs[owner[i]] += combined[i];

  if (!replaced) return paragraph;

  // Rewrite back-to-front so earlier elements keep their recorded offsets.
  let result = paragraph;
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    const element = elements[index];
    result =
      result.slice(0, element.start) +
      renderTextElement(element.attrs, outputs[index]) +
      result.slice(element.end);
  }
  return result;
}

/** Replaces every tag in a whole document part. */
export function replaceMergeTags(
  xml: string,
  values: Readonly<Record<string, string>>,
): string {
  return xml.replace(PARAGRAPH_PATTERN, paragraph =>
    replaceMergeTagsInParagraph(paragraph, values),
  );
}

export type DocumentBody = {
  /** Everything up to and including the `<w:body>` open tag. */
  head: string;
  /** The body's content, minus the trailing section properties. */
  content: string;
  /** The body-level `<w:sectPr>`, or '' when the document has none. */
  sectPr: string;
  /** `</w:body>` onwards. */
  tail: string;
};

export class DocxStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocxStructureError';
  }
}

/** Splits `word/document.xml` so the body content can be repeated per record.
 *
 * The body-level `<w:sectPr>` — page size, margins, and which header/footer
 * parts apply — is the last child of `<w:body>` and must stay exactly once, at
 * the end. Section properties nested inside a paragraph's `<w:pPr>` (a manual
 * section break) are part of the content and repeat with it. */
export function splitDocumentBody(xml: string): DocumentBody {
  const open = /<w:body(?:\s[^>]*)?>/.exec(xml);
  const closeIndex = xml.lastIndexOf('</w:body>');
  if (!open || closeIndex === -1 || closeIndex < open.index) {
    throw new DocxStructureError('This file is missing a Word document body.');
  }

  const head = xml.slice(0, open.index + open[0].length);
  const tail = xml.slice(closeIndex);
  const body = xml.slice(open.index + open[0].length, closeIndex);

  const sectPrIndex = body.lastIndexOf('<w:sectPr');
  if (sectPrIndex !== -1) {
    const trailing = body.slice(sectPrIndex);
    // Only a *trailing* sectPr is the body-level one; anything else is nested
    // in a paragraph and belongs to the repeating content.
    if (/<\/w:sectPr>\s*$/.test(trailing) || /^<w:sectPr(?:\s[^>]*)?\/>\s*$/.test(trailing)) {
      return { head, content: body.slice(0, sectPrIndex), sectPr: trailing, tail };
    }
  }
  return { head, content: body, sectPr: '', tail };
}

/** Builds the combined document: the template's body repeated once per record,
 * each copy filled from that record, separated by page breaks. */
export function combineMergedDocuments(
  xml: string,
  valuesPerRecord: ReadonlyArray<Readonly<Record<string, string>>>,
): string {
  const { head, content, sectPr, tail } = splitDocumentBody(xml);
  const sections = valuesPerRecord.map(values => replaceMergeTags(content, values));
  return head + sections.join(PAGE_BREAK_PARAGRAPH) + sectPr + tail;
}

export type RoutedDocumentSection = {
  xml: string;
  values: Readonly<Record<string, string>>;
};

/** Combines bodies from compatible templates while the default document owns
 * package-wide section properties and supporting parts. */
export function combineRoutedDocuments(
  defaultXml: string,
  sections: ReadonlyArray<RoutedDocumentSection>,
): string {
  const { head, sectPr, tail } = splitDocumentBody(defaultXml);
  const bodies = sections.map(section => {
    const source = splitDocumentBody(section.xml);
    return replaceMergeTags(source.content, section.values);
  });
  return head + bodies.join(PAGE_BREAK_PARAGRAPH) + sectPr + tail;
}
