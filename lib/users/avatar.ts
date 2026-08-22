export const AVATAR_BUCKET = 'avatars';
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];
export type AvatarFileError = 'type' | 'size';

export function isAvatarMimeType(type: string): type is AvatarMimeType {
  return (AVATAR_MIME_TYPES as readonly string[]).includes(type);
}

export function validateAvatarFile(file: { type: string; size: number }): AvatarFileError | null {
  if (!isAvatarMimeType(file.type)) return 'type';
  if (file.size <= 0 || file.size > AVATAR_MAX_BYTES) return 'size';
  return null;
}

export function avatarFileErrorMessage(error: AvatarFileError): string {
  switch (error) {
    case 'type':
      return 'Use a JPEG, PNG, WebP, or GIF image.';
    case 'size':
      return 'Image must be 2 MB or smaller.';
    default: {
      const _exhaustive: never = error;
      return _exhaustive;
    }
  }
}

export function avatarExtension(mimeType: string): string | null {
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

export function avatarObjectPath(userId: string, mimeType: string, id: string): string {
  const ext = avatarExtension(mimeType);
  if (!ext) throw new Error('Unsupported image type');
  return `${userId}/${id}.${ext}`;
}

const PUBLIC_OBJECT_MARKER = `/storage/v1/object/public/${AVATAR_BUCKET}/`;

function avatarObjectPathFromPublicUrl(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    const markerAt = pathname.indexOf(PUBLIC_OBJECT_MARKER);
    if (markerAt === -1) return null;
    const path = decodeURIComponent(pathname.slice(markerAt + PUBLIC_OBJECT_MARKER.length));
    if (!path || path.includes('..') || path.includes('\\')) return null;
    return path;
  } catch {
    return null;
  }
}

function ownedAvatarObjectPath(url: string | null | undefined, userId: string): string | null {
  if (!url) return null;
  const path = avatarObjectPathFromPublicUrl(url);
  if (!path) return null;
  const prefix = `${userId}/`;
  if (!path.startsWith(prefix)) return null;
  const filename = path.slice(prefix.length);
  if (!filename || filename.includes('/')) return null;
  return path;
}

/** Objects to delete after an avatar replace: the previous file on success, or the orphaned upload on a failed profile update. */
export function avatarObjectsToRemove(input: {
  previousUrl: string | null | undefined;
  userId: string;
  newPath: string;
  profileUpdated: boolean;
}): string[] {
  if (!input.profileUpdated) return [input.newPath];
  const previous = ownedAvatarObjectPath(input.previousUrl, input.userId);
  if (!previous || previous === input.newPath) return [];
  return [previous];
}

/** Synchronous lock so overlapping file picks cannot start two uploads. */
export function createAvatarUploadLock() {
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
