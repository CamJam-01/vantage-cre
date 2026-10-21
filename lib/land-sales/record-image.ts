/** Non-catalog record photos: zero or more images per sale row, each with an
 * optional caption. Stored outside CoStar CSV; Print embeds them via
 * `{{ record_image }}` (README §3A carve-outs, §6.7). */

export const RECORD_IMAGES_COLUMN = '_record_images';
/** @deprecated Prefer `RECORD_IMAGES_COLUMN`. Kept for migration / drift guards. */
export const RECORD_IMAGE_COLUMN = '_record_image_path';
/** @deprecated Prefer per-entry caption on `RECORD_IMAGES_COLUMN`. */
export const RECORD_IMAGE_CAPTION_COLUMN = '_record_image_caption';

export const RECORD_IMAGE_BUCKET = 'comp-images';
export const RECORD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const RECORD_IMAGE_MAX_COUNT = 12;
export const RECORD_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export type RecordImageEntry = {
  path: string;
  caption: string;
};

export type RecordImageMimeType = (typeof RECORD_IMAGE_MIME_TYPES)[number];
export type RecordImageFileError = 'type' | 'size';

/** Empty or whitespace-only captions store as "". */
export function normalizeRecordImageCaption(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function isRecordImageMimeType(type: string): type is RecordImageMimeType {
  return (RECORD_IMAGE_MIME_TYPES as readonly string[]).includes(type);
}

/** Browsers often omit `File.type` (or send `application/octet-stream`) for
 * otherwise valid images — fall back to the filename extension so Upload is
 * not blocked by an empty Content-Type. */
export function resolveRecordImageMimeType(file: {
  type?: string;
  name?: string;
}): RecordImageMimeType | null {
  const type = (file.type ?? '').trim().toLowerCase();
  if (isRecordImageMimeType(type)) return type;

  const name = (file.name ?? '').trim().toLowerCase();
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1) : '';
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return null;
  }
}

export function validateRecordImageFile(file: {
  type?: string;
  size: number;
  name?: string;
}): RecordImageFileError | null {
  if (!resolveRecordImageMimeType(file)) return 'type';
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

/** Drop malformed jsonb entries rather than blanking the record screen. */
export function parseRecordImages(value: unknown): RecordImageEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const images: RecordImageEntry[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const path = typeof (entry as { path?: unknown }).path === 'string'
      ? (entry as { path: string }).path.trim()
      : '';
    if (!path || seen.has(path)) continue;
    seen.add(path);
    images.push({
      path,
      caption: normalizeRecordImageCaption((entry as { caption?: unknown }).caption),
    });
    if (images.length >= RECORD_IMAGE_MAX_COUNT) break;
  }
  return images;
}

/** Prefer `_record_images`; fall back to the legacy single path/caption pair. */
export function readRecordImagesFromRow(row: Record<string, unknown>): RecordImageEntry[] {
  if (Object.prototype.hasOwnProperty.call(row, RECORD_IMAGES_COLUMN)) {
    return parseRecordImages(row[RECORD_IMAGES_COLUMN]);
  }
  const path = typeof row[RECORD_IMAGE_COLUMN] === 'string'
    ? row[RECORD_IMAGE_COLUMN].trim()
    : '';
  if (!path) return [];
  return [{
    path,
    caption: normalizeRecordImageCaption(row[RECORD_IMAGE_CAPTION_COLUMN]),
  }];
}

export function applyRecordImageCaptionUpdates(
  images: ReadonlyArray<RecordImageEntry>,
  updates: ReadonlyArray<{ path: string; caption: string }>,
): RecordImageEntry[] {
  if (updates.length === 0) return images.map(image => ({ ...image }));
  const byPath = new Map(updates.map(update => [update.path, update.caption]));
  return images.map(image => (
    byPath.has(image.path)
      ? { path: image.path, caption: byPath.get(image.path) ?? '' }
      : { ...image }
  ));
}

export function parseRecordImageCaptionUpdates(
  formData: FormData,
): Array<{ path: string; caption: string }> {
  const paths = formData.getAll('record_image_path');
  const captions = formData.getAll('record_image_caption');
  const updates: Array<{ path: string; caption: string }> = [];
  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    if (typeof path !== 'string' || !path.trim()) continue;
    const caption = captions[index];
    updates.push({
      path: path.trim(),
      caption: normalizeRecordImageCaption(typeof caption === 'string' ? caption : ''),
    });
  }
  return updates;
}

export function appendRecordImage(
  images: ReadonlyArray<RecordImageEntry>,
  entry: RecordImageEntry,
): { ok: true; images: RecordImageEntry[] } | { ok: false; error: string } {
  if (images.length >= RECORD_IMAGE_MAX_COUNT) {
    return { ok: false, error: `At most ${RECORD_IMAGE_MAX_COUNT} photos per record.` };
  }
  if (images.some(image => image.path === entry.path)) {
    return { ok: false, error: 'That photo is already attached.' };
  }
  return { ok: true, images: [...images, { path: entry.path, caption: entry.caption }] };
}

export function removeRecordImageAtPath(
  images: ReadonlyArray<RecordImageEntry>,
  path: string,
): RecordImageEntry[] {
  return images.filter(image => image.path !== path);
}

export function recordImageStoragePaths(images: ReadonlyArray<RecordImageEntry>): string[] {
  return images.map(image => image.path);
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
