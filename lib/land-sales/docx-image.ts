import type JSZip from 'jszip';
import { MERGE_TAG_PATTERN } from './merge-tags';

/** OPC helpers for embedding a record photo when `{{ record_image }}` is filled. */

export const RECORD_IMAGE_TAG_NAME = 'record_image';

const DOCUMENT_RELS_PART = 'word/_rels/document.xml.rels';
const CONTENT_TYPES_PART = '[Content_Types].xml';

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
};

const EXT_FOR_MIME: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** ~3" × 2.25" in EMUs (914400 EMUs = 1 inch). */
const IMAGE_WIDTH_EMU = 2743200;
const IMAGE_HEIGHT_EMU = 2057400;

const PARAGRAPH_PATTERN = /<w:p\b[\s\S]*?<\/w:p>/g;
const TEXT_ELEMENT_PATTERN = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/g;

function nextRelationshipId(relsXml: string): string {
  let max = 0;
  for (const match of relsXml.matchAll(/\bId="rId(\d+)"/g)) {
    max = Math.max(max, Number(match[1]));
  }
  return `rId${max + 1}`;
}

function ensureRelsFile(zip: JSZip): string {
  const existing = zip.file(DOCUMENT_RELS_PART);
  if (existing) return DOCUMENT_RELS_PART;
  zip.file(
    DOCUMENT_RELS_PART,
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>',
  );
  return DOCUMENT_RELS_PART;
}

function ensureContentTypeDefault(contentTypesXml: string, extension: string, contentType: string): string {
  const escaped = extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`Extension="${escaped}"`, 'i').test(contentTypesXml)) return contentTypesXml;
  const defaultTag = `<Default Extension="${extension}" ContentType="${contentType}"/>`;
  if (contentTypesXml.includes('</Types>')) {
    return contentTypesXml.replace('</Types>', `${defaultTag}</Types>`);
  }
  return contentTypesXml;
}

function drawingParagraph(relationshipId: string, docPrId: number): string {
  // Declare drawing namespaces on the inline node so templates whose root
  // omitted them still open; Word-authored packages already have these.
  return (
    `<w:p>`
    + `<w:r>`
    + `<w:drawing>`
    + `<wp:inline`
    + ` xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"`
    + ` xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"`
    + ` xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`
    + ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`
    + ` distT="0" distB="0" distL="0" distR="0">`
    + `<wp:extent cx="${IMAGE_WIDTH_EMU}" cy="${IMAGE_HEIGHT_EMU}"/>`
    + `<wp:docPr id="${docPrId}" name="Record Image"/>`
    + `<a:graphic>`
    + `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`
    + `<pic:pic>`
    + `<pic:nvPicPr><pic:cNvPr id="0" name="record-image"/><pic:cNvPicPr/></pic:nvPicPr>`
    + `<pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + `<pic:spPr>`
    + `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${IMAGE_WIDTH_EMU}" cy="${IMAGE_HEIGHT_EMU}"/></a:xfrm>`
    + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`
    + `</pic:spPr>`
    + `</pic:pic>`
    + `</a:graphicData>`
    + `</a:graphic>`
    + `</wp:inline>`
    + `</w:drawing>`
    + `</w:r>`
    + `</w:p>`
  );
}

function paragraphPlainText(paragraph: string): string {
  let text = '';
  for (const match of paragraph.matchAll(TEXT_ELEMENT_PATTERN)) {
    text += match[2]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }
  return text;
}

/** Adds image bytes to the package and returns the new relationship id. */
export async function addRecordImageToDocx(
  zip: JSZip,
  bytes: Uint8Array,
  mimeType: string,
  fileStem: string,
): Promise<string> {
  const contentType = IMAGE_CONTENT_TYPES[mimeType];
  const extension = EXT_FOR_MIME[mimeType];
  if (!contentType || !extension) {
    throw new Error(`Unsupported image type for DOCX embed: ${mimeType}`);
  }

  const mediaPath = `word/media/${fileStem}.${extension}`;
  zip.file(mediaPath, bytes);

  ensureRelsFile(zip);
  const relsFile = zip.file(DOCUMENT_RELS_PART);
  if (!relsFile) throw new Error('Could not open document relationships.');
  let relsXml = await relsFile.async('string');
  const relationshipId = nextRelationshipId(relsXml);
  const relationship =
    `<Relationship Id="${relationshipId}" `
    + `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" `
    + `Target="media/${fileStem}.${extension}"/>`;
  if (relsXml.includes('</Relationships>')) {
    relsXml = relsXml.replace('</Relationships>', `${relationship}</Relationships>`);
  } else {
    relsXml += relationship;
  }
  zip.file(DOCUMENT_RELS_PART, relsXml);

  const typesFile = zip.file(CONTENT_TYPES_PART);
  if (typesFile) {
    const typesXml = ensureContentTypeDefault(await typesFile.async('string'), extension, contentType);
    zip.file(CONTENT_TYPES_PART, typesXml);
  }

  return relationshipId;
}

export type RecordImageEmbed = {
  relationshipId: string;
  caption?: string;
};

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function captionParagraph(caption: string): string {
  return `<w:p><w:r><w:t>${escapeXmlText(caption)}</w:t></w:r></w:p>`;
}

function imageBlock(images: ReadonlyArray<RecordImageEmbed>, docPrIdStart: number): string {
  let docPrId = docPrIdStart;
  return images.map(image => {
    const drawing = drawingParagraph(image.relationshipId, docPrId++);
    const caption = image.caption?.trim();
    return caption ? `${drawing}${captionParagraph(caption)}` : drawing;
  }).join('');
}

/** Replaces every `{{ record_image }}` paragraph with embedded drawing(s) (or
 * blanks the tag when there is no image). Multiple photos expand into stacked
 * drawings with captions. The tag is expected on its own line in the template. */
export function replaceRecordImageTags(
  xml: string,
  images: ReadonlyArray<RecordImageEmbed> | string | null,
  docPrIdBase = 1000,
): string {
  const embeds: ReadonlyArray<RecordImageEmbed> = typeof images === 'string'
    ? [{ relationshipId: images }]
    : (images ?? []);

  return xml.replace(PARAGRAPH_PATTERN, paragraph => {
    const plain = paragraphPlainText(paragraph);
    if (!plain.includes('{{')) return paragraph;

    const matches = [...plain.matchAll(MERGE_TAG_PATTERN)];
    const imageMatch = matches.find(match => match[1].toLowerCase() === RECORD_IMAGE_TAG_NAME);
    if (!imageMatch) return paragraph;

    // Tag alone (aside from whitespace) → drawings or empty.
    const withoutTag = plain.replace(imageMatch[0], '').trim();
    if (withoutTag === '') {
      return embeds.length > 0 ? imageBlock(embeds, docPrIdBase) : '<w:p/>';
    }

    // Inline with other text: drop the tag; embedding mid-sentence is not supported.
    return paragraph.replace(MERGE_TAG_PATTERN, (full, name: string) => (
      name.toLowerCase() === RECORD_IMAGE_TAG_NAME ? '' : full
    ));
  });
}
