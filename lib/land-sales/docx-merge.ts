import JSZip from 'jszip';
import { combineMergedDocuments, DocxStructureError, replaceMergeTags } from './docx-xml';

/** Zip-level half of the merge: a .docx is an OPC package (a zip of XML
 * parts), so filling a template means rewriting `word/document.xml` and
 * re-packing everything else — styles, numbering, fonts, images — untouched.
 * Server-only; the XML work lives in `docx-xml.ts`. */

const DOCUMENT_PART = 'word/document.xml';

/** Running headers and footers belong to the document *section*, not to a
 * record, so in a combined document they can only carry one record's values.
 * They are filled from the first selected record. */
const HEADER_FOOTER_PATTERN = /^word\/(header|footer)\d*\.xml$/;

export class DocxTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocxTemplateError';
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
