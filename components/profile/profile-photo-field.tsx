'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { updateAvatarAction } from '@/app/(app)/profile/actions';
import {
  AVATAR_MIME_TYPES,
  avatarFileErrorMessage,
  createAvatarUploadLock,
  validateAvatarFile,
} from '@/lib/users/avatar';

export function ProfilePhotoField({ initialUrl }: { initialUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadLockRef = useRef(createAvatarUploadLock());
  const [previewUrl, setPreviewUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (!uploadLockRef.current.tryAcquire()) return;

    const invalid = validateAvatarFile(file);
    if (invalid) {
      uploadLockRef.current.release();
      setError(avatarFileErrorMessage(invalid));
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.set('avatar', file);
      const result = await updateAvatarAction(formData);

      if (result?.error) {
        setPreviewUrl(initialUrl);
        setError(result.error);
        URL.revokeObjectURL(localUrl);
        return;
      }

      setPreviewUrl(result?.avatarUrl ?? localUrl);
      router.refresh();
    } finally {
      uploadLockRef.current.release();
      setUploading(false);
    }
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (uploadLockRef.current.inFlight) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    setDragging(true);
  }

  function onDragLeave() {
    setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (uploadLockRef.current.inFlight) return;
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div
      aria-busy={uploading}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        type="button"
        onClick={openPicker}
        disabled={uploading}
        aria-label="Upload profile photo"
        style={{
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: uploading ? 'wait' : 'pointer',
          borderRadius: '50%',
          ...(dragging ? { outline: '2px solid var(--color-accent-400)', outlineOffset: 2 } : {}),
        }}
      >
        <ProfileAvatar src={previewUrl} size={96} iconSize={40} />
      </button>
      <input
        ref={inputRef}
        id="avatar-upload"
        type="file"
        accept={AVATAR_MIME_TYPES.join(',')}
        aria-label="Choose profile photo"
        disabled={uploading}
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = '';
        }}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      />
      <button type="button" className="btn btn-ghost" onClick={openPicker} disabled={uploading} style={{ fontSize: 12 }}>
        {uploading ? 'Uploading…' : previewUrl ? 'Replace photo' : 'Upload photo'}
      </button>
      {error && <div className="record-error" style={{ textAlign: 'center', maxWidth: 120 }}>{error}</div>}
    </div>
  );
}
