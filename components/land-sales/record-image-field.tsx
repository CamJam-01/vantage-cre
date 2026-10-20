'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Trash2 } from 'lucide-react';
import {
  removeRecordImageAction,
  updateRecordImageAction,
} from '@/app/(app)/land-sales/actions';
import {
  RECORD_IMAGE_CAPTION_COLUMN,
  RECORD_IMAGE_MIME_TYPES,
  createRecordImageUploadLock,
  recordImageFileErrorMessage,
  validateRecordImageFile,
} from '@/lib/land-sales/record-image';
import type { SalesPathId } from '@/lib/land-sales/sales-path';

export function RecordImageField({
  pathId,
  recordId,
  initialSignedUrl,
  initialCaption = '',
  canEdit,
}: {
  pathId: SalesPathId;
  recordId: string;
  initialSignedUrl: string | null;
  initialCaption?: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadLockRef = useRef(createRecordImageUploadLock());
  const [previewUrl, setPreviewUrl] = useState(initialSignedUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const saved = Boolean(recordId);
  const editable = canEdit && saved;
  const caption = initialCaption.trim();

  async function handleFile(file: File) {
    if (!editable || !uploadLockRef.current.tryAcquire()) return;

    const invalid = validateRecordImageFile(file);
    if (invalid) {
      uploadLockRef.current.release();
      setError(recordImageFileErrorMessage(invalid));
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.set('image', file);
      const result = await updateRecordImageAction(pathId, recordId, formData);
      if (result?.error) {
        setPreviewUrl(initialSignedUrl);
        setError(result.error);
        URL.revokeObjectURL(localUrl);
        return;
      }
      setPreviewUrl(result?.signedUrl ?? localUrl);
      router.refresh();
    } finally {
      uploadLockRef.current.release();
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!editable || !uploadLockRef.current.tryAcquire()) return;
    setUploading(true);
    setError(null);
    try {
      const result = await removeRecordImageAction(pathId, recordId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setPreviewUrl(null);
      router.refresh();
    } finally {
      uploadLockRef.current.release();
      setUploading(false);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!editable || uploadLockRef.current.inFlight) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    setDragging(true);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!editable || uploadLockRef.current.inFlight) return;
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="record-image-field">
      {!saved ? (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>
          Save the record before uploading an image.
        </p>
      ) : (
        <div
          aria-busy={uploading}
          onDragOver={onDragOver}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            border: `1px solid ${dragging ? 'var(--color-accent)' : 'var(--color-divider)'}`,
            background: dragging ? 'rgba(var(--color-accent-rgb), 0.06)' : 'var(--color-paper)',
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={caption || 'Record'}
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: 240,
                objectFit: 'contain',
                background: 'var(--color-neutral-100)',
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
                minHeight: 120,
                color: 'var(--color-neutral-600)',
                fontSize: 14,
              }}
            >
              <ImagePlus size={20} strokeWidth={1.5} aria-hidden />
              No image attached
            </div>
          )}

          {editable && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <input
                ref={inputRef}
                type="file"
                accept={RECORD_IMAGE_MIME_TYPES.join(',')}
                hidden
                onChange={event => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void handleFile(file);
                }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? 'Uploading…' : previewUrl ? 'Replace image' : 'Upload image'}
              </button>
              {previewUrl && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={uploading}
                  onClick={() => { void handleRemove(); }}
                >
                  <Trash2 size={16} strokeWidth={1.5} aria-hidden />
                  Remove
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {canEdit ? (
        <div className="field" style={{ marginTop: 'var(--space-3)' }}>
          <label htmlFor="field-record-image-caption">Caption</label>
          <input
            id="field-record-image-caption"
            type="text"
            name={RECORD_IMAGE_CAPTION_COLUMN}
            className="input"
            defaultValue={initialCaption}
            placeholder="Caption"
            autoComplete="off"
          />
        </div>
      ) : caption ? (
        <p className="record-image-caption" style={{ margin: 'var(--space-3) 0 0' }}>
          {caption}
        </p>
      ) : null}

      {error && (
        <p role="status" className="record-error" style={{ margin: 'var(--space-3) 0 0' }}>
          {error}
        </p>
      )}
    </div>
  );
}
