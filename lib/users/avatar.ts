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
