'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Trash2 } from 'lucide-react';
import {
  addRecordImageAction,
  removeRecordImageAction,
} from '@/app/(app)/land-sales/actions';
import {
  RECORD_IMAGE_MAX_COUNT,
  RECORD_IMAGE_MIME_TYPES,
  createRecordImageUploadLock,
  recordImageFileErrorMessage,
  validateRecordImageFile,
  type RecordImageEntry,
} from '@/lib/land-sales/record-image';
import type { SalesPathId } from '@/lib/land-sales/sales-path';

export function RecordImageField({
  pathId,
  recordId,
  initialImages = [],
  imageSignedUrls = {},
  canEdit,
}: {
  pathId: SalesPathId;
  recordId: string;
  initialImages?: RecordImageEntry[];
  imageSignedUrls?: Record<string, string>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadLockRef = useRef(createRecordImageUploadLock());
  const [images, setImages] = useState(initialImages);
  const [signedUrls, setSignedUrls] = useState(imageSignedUrls);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const saved = Boolean(recordId);
  const editable = canEdit && saved;
  const atLimit = images.length >= RECORD_IMAGE_MAX_COUNT;

  async function handleFiles(fileList: FileList | File[]) {
    if (!editable || !uploadLockRef.current.tryAcquire()) return;
    const files = [...fileList];
    if (files.length === 0) {
      uploadLockRef.current.release();
      return;
    }

    setError(null);
    setUploading(true);
    let count = images.length;
    try {
      for (const file of files) {
        if (count >= RECORD_IMAGE_MAX_COUNT) {
          setError(`At most ${RECORD_IMAGE_MAX_COUNT} photos per record.`);
          break;
        }
        const invalid = validateRecordImageFile(file);
        if (invalid) {
          setError(recordImageFileErrorMessage(invalid));
          continue;
        }

        const formData = new FormData();
        formData.set('image', file);
        const result = await addRecordImageAction(pathId, recordId, formData);
        if (result?.error) {
          setError(result.error);
          break;
        }
        if (result?.path) {
          count += 1;
          const localUrl = result.signedUrl ?? URL.createObjectURL(file);
          setImages(prev => [...prev, { path: result.path!, caption: '' }]);
          setSignedUrls(prev => ({ ...prev, [result.path!]: localUrl }));
        }
      }
      router.refresh();
    } finally {
      uploadLockRef.current.release();
      setUploading(false);
    }
  }

  async function handleRemove(path: string) {
    if (!editable || !uploadLockRef.current.tryAcquire()) return;
    setUploading(true);
    setError(null);
    try {
      const result = await removeRecordImageAction(pathId, recordId, path);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setImages(prev => prev.filter(image => image.path !== path));
      setSignedUrls(prev => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      router.refresh();
    } finally {
      uploadLockRef.current.release();
      setUploading(false);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!editable || atLimit || uploadLockRef.current.inFlight) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    setDragging(true);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!editable || atLimit || uploadLockRef.current.inFlight) return;
    void handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="record-image-field">
      {!saved ? (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>
          Save the record before uploading photos.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {images.map((image, index) => {
            const url = signedUrls[image.path];
            const captionId = `field-record-image-caption-${index}`;
            return (
              <div
                key={image.path}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  border: '1px solid var(--color-divider)',
                  background: 'var(--color-paper)',
                }}
              >
                {url ? (
                  <img
                    src={url}
                    alt={image.caption || `Photo ${index + 1}`}
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
                      minHeight: 120,
                      color: 'var(--color-neutral-600)',
                      fontSize: 14,
                    }}
                  >
                    Photo unavailable
                  </div>
                )}

                {canEdit ? (
                  <div className="field">
                    <label htmlFor={captionId}>Caption</label>
                    <input type="hidden" name="record_image_path" value={image.path} />
                    <input
                      id={captionId}
                      type="text"
                      name="record_image_caption"
                      className="input"
                      defaultValue={image.caption}
                      placeholder="Caption"
                      autoComplete="off"
                    />
                  </div>
                ) : image.caption ? (
                  <p className="record-image-caption" style={{ margin: 0 }}>
                    {image.caption}
                  </p>
                ) : null}

                {editable && (
                  <div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={uploading}
                      onClick={() => { void handleRemove(image.path); }}
                    >
                      <Trash2 size={16} strokeWidth={1.5} aria-hidden />
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {editable && !atLimit && (
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                  minHeight: 96,
                  color: 'var(--color-neutral-600)',
                  fontSize: 14,
                }}
              >
                <ImagePlus size={20} strokeWidth={1.5} aria-hidden />
                {images.length === 0 ? 'No photos attached' : 'Add another photo'}
              </div>
              <div>
                <input
                  ref={inputRef}
                  type="file"
                  accept={RECORD_IMAGE_MIME_TYPES.join(',')}
                  multiple
                  hidden
                  onChange={event => {
                    const list = event.target.files;
                    event.target.value = '';
                    if (list) void handleFiles(list);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={uploading}
                  onClick={() => inputRef.current?.click()}
                >
                  {uploading ? 'Uploading…' : 'Upload photos'}
                </button>
              </div>
            </div>
          )}

          {editable && atLimit && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-700)' }}>
              Maximum of {RECORD_IMAGE_MAX_COUNT} photos reached.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="status" className="record-error" style={{ margin: 'var(--space-3) 0 0' }}>
          {error}
        </p>
      )}
    </div>
  );
}
