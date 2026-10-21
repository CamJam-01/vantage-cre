'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import {
  addRecordImageAction,
  removeRecordImageAction,
  updateRecordImageAction,
} from '@/app/(app)/land-sales/actions';
import { Dialog } from '@/components/ui/dialog';
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
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const uploadLockRef = useRef(createRecordImageUploadLock());
  const lightboxListRef = useRef<HTMLDivElement>(null);
  const lightboxId = useId();
  const editCaptionId = useId();
  const [images, setImages] = useState(initialImages);
  const [signedUrls, setSignedUrls] = useState(imageSignedUrls);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Keep local previews aligned after a Server Action `router.refresh()`.
  // Compare by value — parents often pass a fresh `[]` / `{}` each render.
  const imagesSignature = initialImages.map(image => `${image.path}\0${image.caption}`).join('\n');
  const urlsSignature = Object.entries(imageSignedUrls).map(([path, url]) => `${path}\0${url}`).join('\n');
  useEffect(() => {
    setImages(initialImages);
    setSignedUrls(imageSignedUrls);
  }, [imagesSignature, urlsSignature, initialImages, imageSignedUrls]);

  useEffect(() => {
    if (images.length === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex(index => Math.min(index, images.length - 1));
  }, [images.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [lightboxOpen]);

  // Scroll the lightbox to the carousel's active slide when it opens.
  useEffect(() => {
    if (!lightboxOpen) return;
    const list = lightboxListRef.current;
    const target = list?.children[activeIndex] as HTMLElement | undefined;
    target?.scrollIntoView({ block: 'center' });
  }, [lightboxOpen, activeIndex]);

  useEffect(() => {
    return () => {
      if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
    };
  }, [editPreviewUrl]);

  const saved = Boolean(recordId);
  const editable = canEdit && saved;
  const atLimit = images.length >= RECORD_IMAGE_MAX_COUNT;
  const multi = images.length > 1;
  const active = images[activeIndex] ?? null;
  const activeUrl = active ? signedUrls[active.path] : undefined;

  function showError(message: string) {
    setError(message);
    queueMicrotask(() => {
      errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function goTo(index: number) {
    if (images.length === 0) return;
    const next = ((index % images.length) + images.length) % images.length;
    setActiveIndex(next);
  }

  function openEdit() {
    if (!active || !editable) return;
    setEditCaption(active.caption);
    setEditFile(null);
    setEditError(null);
    if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
    setEditPreviewUrl(null);
    setEditing(true);
  }

  function closeEdit() {
    setEditing(false);
    setEditFile(null);
    setEditError(null);
    if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
    setEditPreviewUrl(null);
  }

  function onEditFileChosen(fileList: FileList | File[]) {
    const file = [...fileList][0];
    if (!file) return;
    const invalid = validateRecordImageFile(file);
    if (invalid) {
      setEditError(recordImageFileErrorMessage(invalid));
      return;
    }
    setEditError(null);
    setEditFile(file);
    if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
    setEditPreviewUrl(URL.createObjectURL(file));
  }

  async function saveEdit() {
    if (!active || !editable || !uploadLockRef.current.tryAcquire()) return;
    setUploading(true);
    setEditError(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.set('caption', editCaption);
      if (editFile) formData.set('image', editFile);
      const previousPath = active.path;
      const result = await updateRecordImageAction(pathId, recordId, previousPath, formData);
      if (result?.error) {
        setEditError(result.error);
        return;
      }
      if (result?.path) {
        const nextPath = result.path;
        const nextUrl = result.signedUrl
          ?? editPreviewUrl
          ?? signedUrls[previousPath];
        setImages(prev => prev.map(image => (
          image.path === previousPath
            ? { path: nextPath, caption: editCaption.trim() }
            : image
        )));
        setSignedUrls(prev => {
          const next = { ...prev };
          if (nextPath !== previousPath) delete next[previousPath];
          if (nextUrl) next[nextPath] = nextUrl;
          return next;
        });
      }
      closeEdit();
      router.refresh();
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : 'Could not save photo.');
    } finally {
      uploadLockRef.current.release();
      setUploading(false);
    }
  }

  async function handleFiles(fileList: FileList | File[]) {
    // Snapshot first — `input.files` is a live FileList, and clearing the
    // input (so the same file can be chosen again) empties it in place.
    const files = [...fileList];
    if (!editable || files.length === 0) return;
    if (!uploadLockRef.current.tryAcquire()) return;

    setError(null);
    setUploading(true);
    let count = images.length;
    let lastAddedIndex = activeIndex;
    try {
      for (const file of files) {
        if (count >= RECORD_IMAGE_MAX_COUNT) {
          showError(`At most ${RECORD_IMAGE_MAX_COUNT} photos per record.`);
          break;
        }
        const invalid = validateRecordImageFile(file);
        if (invalid) {
          showError(recordImageFileErrorMessage(invalid));
          continue;
        }

        const formData = new FormData();
        formData.set('image', file);
        const result = await addRecordImageAction(pathId, recordId, formData);
        if (result?.error) {
          showError(result.error);
          break;
        }
        if (result?.path) {
          lastAddedIndex = count;
          count += 1;
          const localUrl = result.signedUrl ?? URL.createObjectURL(file);
          setImages(prev => [...prev, { path: result.path!, caption: '' }]);
          setSignedUrls(prev => ({ ...prev, [result.path!]: localUrl }));
        }
      }
      setActiveIndex(lastAddedIndex);
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Upload failed.';
      showError(message);
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
        showError(result.error);
        return;
      }
      setImages(prev => prev.filter(image => image.path !== path));
      setSignedUrls(prev => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not remove photo.';
      showError(message);
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
      {/* Captions still ride the record Save form via hidden fields. */}
      {canEdit && images.map(image => (
        <span key={image.path} hidden>
          <input type="hidden" name="record_image_path" value={image.path} />
          <input type="hidden" name="record_image_caption" value={image.caption} />
        </span>
      ))}

      {!saved ? (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>
          Save the record before uploading photos.
        </p>
      ) : (
        <div className="record-image-stack">
          {images.length > 0 && (
            <div className="record-image-viewer">
              <div className="record-image-carousel" aria-roledescription="carousel">
                {multi && (
                  <button
                    type="button"
                    className="record-image-nav record-image-nav-prev"
                    aria-label="Previous photo"
                    onClick={() => goTo(activeIndex - 1)}
                  >
                    <ChevronLeft size={18} strokeWidth={1.5} aria-hidden />
                  </button>
                )}

                <div className="record-image-stage">
                  {activeUrl ? (
                    <img
                      src={activeUrl}
                      alt={active?.caption || `Photo ${activeIndex + 1}`}
                      className="record-image-photo"
                    />
                  ) : (
                    <div className="record-image-missing">Photo unavailable</div>
                  )}

                  {editable && active && (
                    <div className="record-image-stage-actions">
                      <button
                        type="button"
                        className="btn btn-secondary record-image-edit"
                        disabled={uploading}
                        aria-label="Edit photo"
                        onClick={openEdit}
                      >
                        <Pencil size={16} strokeWidth={1.5} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="btn record-image-remove"
                        disabled={uploading}
                        aria-label="Remove photo"
                        onClick={() => { void handleRemove(active.path); }}
                      >
                        <Trash2 size={16} strokeWidth={1.5} aria-hidden />
                      </button>
                    </div>
                  )}
                </div>

                {multi && (
                  <button
                    type="button"
                    className="record-image-nav record-image-nav-next"
                    aria-label="Next photo"
                    onClick={() => goTo(activeIndex + 1)}
                  >
                    <ChevronRight size={18} strokeWidth={1.5} aria-hidden />
                  </button>
                )}
              </div>

              <p className="record-image-caption">
                {active?.caption || '\u00a0'}
              </p>

              {multi && (
                <div className="record-image-carousel-footer">
                  <div className="record-image-dots" role="tablist" aria-label="Photos">
                    {images.map((image, index) => (
                      <button
                        key={image.path}
                        type="button"
                        role="tab"
                        aria-selected={index === activeIndex}
                        aria-label={`Photo ${index + 1}`}
                        className={
                          index === activeIndex
                            ? 'record-image-dot is-active'
                            : 'record-image-dot'
                        }
                        onClick={() => setActiveIndex(index)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {multi && (
            <div className="record-image-view-all-row">
              <button
                type="button"
                className="btn btn-ghost record-image-view-all"
                onClick={() => setLightboxOpen(true)}
              >
                View All
              </button>
            </div>
          )}

          {editable && !atLimit && (
            <div
              className={
                dragging
                  ? 'record-image-upload is-dragging'
                  : 'record-image-upload'
              }
              aria-busy={uploading}
              onDragOver={onDragOver}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept={RECORD_IMAGE_MIME_TYPES.join(',')}
                multiple
                hidden
                onChange={event => {
                  const list = event.target.files ? [...event.target.files] : [];
                  event.target.value = '';
                  if (list.length > 0) void handleFiles(list);
                }}
              />
              <button
                type="button"
                className="record-image-dropzone"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus size={16} strokeWidth={1.5} aria-hidden />
                <span>
                  {uploading
                    ? 'Uploading…'
                    : images.length === 0
                      ? 'No photos attached'
                      : 'Add another photo'}
                </span>
              </button>
            </div>
          )}

          {editable && atLimit && (
            <p className="record-image-limit">
              Maximum of {RECORD_IMAGE_MAX_COUNT} photos reached.
            </p>
          )}
        </div>
      )}

      {error && (
        <p
          ref={errorRef}
          role="status"
          className="record-error"
          style={{ margin: 'var(--space-3) 0 0' }}
        >
          {error}
        </p>
      )}

      <Dialog
        open={editing && Boolean(active)}
        title="Edit photo"
        onClose={() => {
          if (!uploading) closeEdit();
        }}
        actions={(
          <>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={uploading}
              onClick={closeEdit}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={uploading}
              onClick={() => { void saveEdit(); }}
            >
              {uploading ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      >
        {active && (
          <div className="record-image-edit-body">
            <div className="record-image-edit-preview">
              {(editPreviewUrl || activeUrl) ? (
                <img
                  src={editPreviewUrl || activeUrl}
                  alt={editCaption || active.caption || 'Photo'}
                />
              ) : (
                <div className="record-image-missing">Photo unavailable</div>
              )}
            </div>
            <div className="field">
              <label htmlFor={editCaptionId}>Caption</label>
              <input
                id={editCaptionId}
                type="text"
                className="input"
                value={editCaption}
                onChange={event => setEditCaption(event.target.value)}
                placeholder="Caption"
                autoComplete="off"
                disabled={uploading}
              />
            </div>
            <input
              ref={replaceInputRef}
              type="file"
              accept={RECORD_IMAGE_MIME_TYPES.join(',')}
              hidden
              onChange={event => {
                const list = event.target.files ? [...event.target.files] : [];
                event.target.value = '';
                if (list.length > 0) onEditFileChosen(list);
              }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={uploading}
              onClick={() => replaceInputRef.current?.click()}
            >
              Replace photo
            </button>
            {editFile ? (
              <p className="record-image-edit-file">{editFile.name}</p>
            ) : null}
            {editError ? (
              <p role="status" className="record-error" style={{ margin: 0 }}>
                {editError}
              </p>
            ) : null}
          </div>
        )}
      </Dialog>

      {lightboxOpen && (
        <div
          className="record-image-lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={lightboxId}
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="record-image-lightbox"
            onClick={event => event.stopPropagation()}
          >
            <div className="record-image-lightbox-head">
              <h2 id={lightboxId} className="record-image-lightbox-title">
                Photos
              </h2>
              <button
                type="button"
                className="btn btn-ghost"
                aria-label="Close"
                onClick={() => setLightboxOpen(false)}
              >
                <X size={18} strokeWidth={1.5} aria-hidden />
              </button>
            </div>
            <div ref={lightboxListRef} className="record-image-lightbox-list">
              {images.map((image, index) => {
                const url = signedUrls[image.path];
                return (
                  <figure key={image.path} className="record-image-lightbox-item">
                    {url ? (
                      <img
                        src={url}
                        alt={image.caption || `Photo ${index + 1}`}
                      />
                    ) : (
                      <div className="record-image-missing">Photo unavailable</div>
                    )}
                    {image.caption ? (
                      <figcaption className="record-image-caption">
                        {image.caption}
                      </figcaption>
                    ) : null}
                  </figure>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
