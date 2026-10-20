/** Non-catalog record image: one photo per sale row, stored outside CoStar CSV
 * and available to Print via `{{ record_image }}` (README §3A carve-outs, §6.7).
 * Caption is edited on create/edit and saved with the record form. */

export const RECORD_IMAGE_COLUMN = '_record_image_path';
export const RECORD_IMAGE_CAPTION_COLUMN = '_record_image_caption';
export const RECORD_IMAGE_BUCKET = 'comp-images';
export const RECORD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const RECORD_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

/** Empty or whitespace-only captions store as null. */
export function normalizeRecordImageCaption(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export type RecordImageMimeType = (typeof RECORD_IMAGE_MIME_TYPES)[number];
export type RecordImageFileError = 'type' | 'size';

export function isRecordImageMimeType(type: string): type is RecordImageMimeType {
  return (RECORD_IMAGE_MIME_TYPES as readonly string[]).includes(type);
}

export function validateRecordImageFile(file: { type: string; size: number }): RecordImageFileError | null {
  if (!isRecordImageMimeType(file.type)) return 'type';
  if (file.size <= 0 || file.size > RECORD_IMAGE_MAX_BYTES) return 'size';
  return null;
}

export function recordImageFileErrorMessage(error: RecordImageFileError): string {
  switch (error) {
    case 'type':
      return 'Use a JPEG, PNG, WebP, or GIF image.';
    case 'size':
      return 'Image must be 5 MB or smaller.';
    default: {
      const _exhaustive: never = error;
      return _exhaustive;
    }
  }
}

export function recordImageExtension(mimeType: string): string | null {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return null;
  }
}

export function recordImageContentType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/** `{table}/{recordId}/{uuid}.ext` — table prefix keeps Land and Improved apart. */
export function recordImageObjectPath(
  table: string,
  recordId: string,
  mimeType: string,
  id: string,
): string {
  const ext = recordImageExtension(mimeType);
  if (!ext) throw new Error('Unsupported image type');
  return `${table}/${recordId}/${id}.${ext}`;
}

export function isOwnedRecordImagePath(path: string, table: string, recordId: string): boolean {
  if (!path || path.includes('..') || path.includes('\\')) return false;
  const prefix = `${table}/${recordId}/`;
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  return Boolean(rest) && !rest.includes('/');
}

/** Objects to delete after a replace: previous file on success, or the orphaned
 * upload when the row update failed. */
export function recordImageObjectsToRemove(input: {
  previousPath: string | null | undefined;
  table: string;
  recordId: string;
  newPath: string;
  rowUpdated: boolean;
}): string[] {
  if (!input.rowUpdated) return [input.newPath];
  const previous = input.previousPath;
  if (!previous || previous === input.newPath) return [];
  if (!isOwnedRecordImagePath(previous, input.table, input.recordId)) return [];
  return [previous];
}

export function createRecordImageUploadLock() {
  let inFlight = false;
  return {
    get inFlight() {
      return inFlight;
    },
    tryAcquire(): boolean {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    release(): void {
      inFlight = false;
    },
  };
}
