import JSZip from 'jszip';
import {
  combineMergedDocuments,
  combineRoutedDocuments,
  DocxStructureError,
  replaceMergeTags,
  splitDocumentBody,
} from './docx-xml';

/** Zip-level half of the merge: a .docx is an OPC package (a zip of XML
 * parts), so filling a template means rewriting `word/document.xml` and
 * re-packing everything else — styles, numbering, fonts, images — untouched.
 * Server-only; the XML work lives in `docx-xml.ts`. */

const DOCUMENT_PART = 'word/document.xml';

/** Running headers and footers belong to the document *section*, not to a
 * record, so in a combined document they can only carry one record's values.
 * They are filled from the first selected record. */
const HEADER_FOOTER_PATTERN = /^word\/(header|footer)\d*\.xml$/;

const SHARED_WORD_PARTS = [
  'word/styles.xml',
  'word/numbering.xml',
  'word/theme/theme1.xml',
  'word/fontTable.xml',
] as const;

const DOCUMENT_RELS_PART = 'word/_rels/document.xml.rels';
const RELATIONSHIP_REFERENCE_PATTERN = /\br:(?:id|embed|link)="([^"]+)"/g;
const RELATIONSHIP_PATTERN = /<Relationship\b([^>]*?)(?:\/>|>[\s\S]*?<\/Relationship>)/g;
const ATTRIBUTE_PATTERN = /([A-Za-z:]+)="([^"]*)"/g;

export class DocxTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocxTemplateError';
  }
}

type LoadedDocx = {
  zip: JSZip;
  documentXml: string;
};

export type RoutedDocxRecord = {
  templateBytes: ArrayBuffer | Uint8Array;
  values: Readonly<Record<string, string>>;
};

async function loadDocx(bytes: ArrayBuffer | Uint8Array): Promise<LoadedDocx> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new DocxTemplateError('A routed template is not a readable .docx file.');
  }
  const documentFile = zip.file(DOCUMENT_PART);
  if (!documentFile) {
    throw new DocxTemplateError('A routed template is not a Word document (no word/document.xml).');
  }
  return { zip, documentXml: await documentFile.async('string') };
}

async function samePart(left: JSZip, right: JSZip, path: string): Promise<boolean> {
  const leftFile = left.file(path);
  const rightFile = right.file(path);
  if (!leftFile || !rightFile) return leftFile === rightFile;
  const [leftBytes, rightBytes] = await Promise.all([
    leftFile.async('uint8array'),
    rightFile.async('uint8array'),
  ]);
  if (leftBytes.length !== rightBytes.length) return false;
  return leftBytes.every((byte, index) => byte === rightBytes[index]);
}

function relationshipAttributes(xml: string): Map<string, Readonly<Record<string, string>>> {
  const relationships = new Map<string, Readonly<Record<string, string>>>();
  for (const relationship of xml.matchAll(RELATIONSHIP_PATTERN)) {
    const attributes: Record<string, string> = {};
    for (const attribute of relationship[1].matchAll(ATTRIBUTE_PATTERN)) {
      attributes[attribute[1]] = attribute[2];
    }
    if (attributes.Id) relationships.set(attributes.Id, attributes);
  }
  return relationships;
}

function referencedRelationshipIds(documentContent: string): string[] {
  return [...documentContent.matchAll(RELATIONSHIP_REFERENCE_PATTERN)].map(match => match[1]);
}

function relationshipPartPath(target: string): string | null {
  if (/^[A-Za-z]+:/.test(target)) return null;
  const parts = ['word', ...target.replaceAll('\\', '/').split('/')];
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }
  return resolved.join('/');
}

async function assertRoutedTemplateCompatibility(
  base: LoadedDocx,
  routed: LoadedDocx,
): Promise<void> {
  for (const path of SHARED_WORD_PARTS) {
    if (!(await samePart(base.zip, routed.zip, path))) {
      throw new DocxTemplateError(
        'Templates in one Output Flow must share Word styles, numbering, theme, and fonts. Create alternate templates from the same base document.',
      );
    }
  }

  const content = splitDocumentBody(routed.documentXml).content;
  const referencedIds = referencedRelationshipIds(content);
  if (referencedIds.length === 0) return;

  const [baseRelsXml, routedRelsXml] = await Promise.all([
    base.zip.file(DOCUMENT_RELS_PART)?.async('string') ?? '',
    routed.zip.file(DOCUMENT_RELS_PART)?.async('string') ?? '',
  ]);
  const baseRels = relationshipAttributes(baseRelsXml);
  const routedRels = relationshipAttributes(routedRelsXml);

  for (const id of referencedIds) {
    const baseRelationship = baseRels.get(id);
    const routedRelationship = routedRels.get(id);
    if (!baseRelationship || !routedRelationship
      || baseRelationship.Type !== routedRelationship.Type
      || baseRelationship.Target !== routedRelationship.Target
      || baseRelationship.TargetMode !== routedRelationship.TargetMode) {
      throw new DocxTemplateError(
        'A routed template body uses a linked Word asset that differs from the default template. Create alternate templates from the same base document.',
      );
    }
    const partPath = relationshipPartPath(routedRelationship.Target);
    if (partPath && !(await samePart(base.zip, routed.zip, partPath))) {
      throw new DocxTemplateError(
        'A routed template body uses an embedded Word asset that differs from the default template. Create alternate templates from the same base document.',
      );
    }
  }
}

/** Merges one template over many records into a single document, one record
 * per section separated by a page break. */
export async function mergeDocx(
  templateBytes: ArrayBuffer | Uint8Array,
  valuesPerRecord: ReadonlyArray<Readonly<Record<string, string>>>,
): Promise<Uint8Array> {
  if (valuesPerRecord.length === 0) {
    throw new DocxTemplateError('Select at least one record to merge.');
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(templateBytes);
  } catch {
    throw new DocxTemplateError('This template is not a readable .docx file.');
  }

  const documentFile = zip.file(DOCUMENT_PART);
  if (!documentFile) {
    throw new DocxTemplateError('This template is not a Word document (no word/document.xml).');
  }

  const documentXml = await documentFile.async('string');
  try {
    zip.file(DOCUMENT_PART, combineMergedDocuments(documentXml, valuesPerRecord));
  } catch (error) {
    if (error instanceof DocxStructureError) throw new DocxTemplateError(error.message);
    throw error;
  }

  const firstRecord = valuesPerRecord[0];
  for (const path of Object.keys(zip.files)) {
    if (!HEADER_FOOTER_PATTERN.test(path)) continue;
    const part = zip.file(path);
    if (!part) continue;
    zip.file(path, replaceMergeTags(await part.async('string'), firstRecord));
  }

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/** Routes every record to its selected template body while the flow's default
 * template owns package-wide resources. Compatibility checks fail visibly
 * instead of producing a DOCX with broken styles or relationship ids. */
export async function mergeRoutedDocx(
  defaultTemplateBytes: ArrayBuffer | Uint8Array,
  records: ReadonlyArray<RoutedDocxRecord>,
): Promise<Uint8Array> {
  if (records.length === 0) {
    throw new DocxTemplateError('Select at least one record to merge.');
  }

  const base = await loadDocx(defaultTemplateBytes);
  const routed = await Promise.all(records.map(record => loadDocx(record.templateBytes)));
  await Promise.all(routed.map(template => assertRoutedTemplateCompatibility(base, template)));

  try {
    base.zip.file(DOCUMENT_PART, combineRoutedDocuments(
      base.documentXml,
      routed.map((template, index) => ({
        xml: template.documentXml,
        values: records[index].values,
      })),
    ));
  } catch (error) {
    if (error instanceof DocxStructureError) throw new DocxTemplateError(error.message);
    throw error;
  }

  const firstRecord = records[0].values;
  for (const path of Object.keys(base.zip.files)) {
    if (!HEADER_FOOTER_PATTERN.test(path)) continue;
    const part = base.zip.file(path);
    if (!part) continue;
    base.zip.file(path, replaceMergeTags(await part.async('string'), firstRecord));
  }

  return base.zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
