/** Shared shape and validation for the named .docx templates admins manage in
 * Database Manager and users pick from in the results page's Merge to DOCX
 * dialog. Pure — imported by both the server actions and the client form. */

export const DOCX_TEMPLATE_BUCKET = 'docx-templates';

export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Comfortably clear of `serverActions.bodySizeLimit` (3mb in next.config.ts),
 * which the upload passes through. */
export const DOCX_TEMPLATE_MAX_BYTES = 2 * 1024 * 1024;

export const TEMPLATE_NAME_MAX_LENGTH = 80;

export type DocxTemplate = {
  id: string;
  name: string;
  storage_path: string;
  updated_at: string;
};

export const DOCX_TEMPLATE_SELECT = 'id, name, storage_path, updated_at';

export type TemplateFileProblem = 'missing' | 'type' | 'size';

/** Word files are checked by extension as well as MIME type: browsers report
 * .docx inconsistently (and as `application/octet-stream` outright when Office
 * isn't installed), so the extension is the reliable signal and the MIME type
 * only rules a file out when it is present and clearly something else. */
export function validateTemplateFile(
  file: { name: string; size: number; type: string } | null | undefined,
): TemplateFileProblem | null {
  if (!file || file.size === 0) return 'missing';
  if (!file.name.toLowerCase().endsWith('.docx')) return 'type';
  if (file.type && file.type !== DOCX_MIME_TYPE && file.type !== 'application/octet-stream') {
    return 'type';
  }
  if (file.size > DOCX_TEMPLATE_MAX_BYTES) return 'size';
  return null;
}

export function templateFileErrorMessage(problem: TemplateFileProblem): string {
  switch (problem) {
    case 'missing':
      return 'Choose a .docx template to upload.';
    case 'type':
      return 'Templates must be Word .docx files. Save a .doc or .dotx file as .docx and try again.';
    case 'size':
      return `Templates must be under ${Math.round(DOCX_TEMPLATE_MAX_BYTES / (1024 * 1024))}MB.`;
    default: {
      const _exhaustive: never = problem;
      return _exhaustive;
    }
  }
}

/** Returns an error message for an unusable template name, or null. */
export function templateNameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Give the template a name.';
  if (trimmed.length > TEMPLATE_NAME_MAX_LENGTH) {
    return `Template names must be ${TEMPLATE_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

/** Storage objects are keyed by row id, never by name — renaming a template
 * must not have to move a file, and two templates may not collide in storage
 * just because their names normalize the same way. */
export function templateObjectPath(id: string): string {
  return `${id}.docx`;
}

/** Filename for the merged download. Built from the template name so a user
 * with several templates can tell the outputs apart, stripped of anything a
 * Content-Disposition header or a filesystem would object to. */
export function mergedFileName(templateName: string, recordCount: number): string {
  const base = templateName
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase();
  const suffix = `${recordCount}-record${recordCount === 1 ? '' : 's'}`;
  return `${base || 'merge'}-${suffix}.docx`;
}

/** Ceiling on one merge. Each record repeats the whole template body, so a
 * careless "select all" against a large result set would otherwise build a
 * document no one can open. */
export const MERGE_RECORD_LIMIT = 100;
