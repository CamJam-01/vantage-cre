import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECORD_IMAGE_CAPTION_COLUMN,
  RECORD_IMAGE_COLUMN,
  RECORD_IMAGES_COLUMN,
  appendRecordImage,
  applyRecordImageCaptionUpdates,
  isOwnedRecordImagePath,
  normalizeRecordImageCaption,
  parseRecordImages,
  readRecordImagesFromRow,
  recordImageObjectPath,
  recordImageObjectsToRemove,
  removeRecordImageAtPath,
  resolveRecordImageMimeType,
  validateRecordImageFile,
} from './record-image.ts';

describe('record-image', () => {
  it('keeps storage columns outside the catalog name space', () => {
    assert.equal(RECORD_IMAGES_COLUMN.startsWith('_'), true);
    assert.equal(RECORD_IMAGE_COLUMN.startsWith('_'), true);
    assert.equal(RECORD_IMAGE_CAPTION_COLUMN.startsWith('_'), true);
  });

  it('normalizes captions to trimmed text', () => {
    assert.equal(normalizeRecordImageCaption('  Facing north  '), 'Facing north');
    assert.equal(normalizeRecordImageCaption('   '), '');
    assert.equal(normalizeRecordImageCaption(null), '');
  });

  it('accepts common image types under the size cap', () => {
    assert.equal(validateRecordImageFile({ type: 'image/png', size: 1024 }), null);
    assert.equal(validateRecordImageFile({ type: 'application/pdf', size: 1024 }), 'type');
    assert.equal(validateRecordImageFile({ type: 'image/png', size: 6 * 1024 * 1024 }), 'size');
  });

  it('resolves MIME from the filename when the browser leaves type blank', () => {
    assert.equal(resolveRecordImageMimeType({ type: '', name: 'site.JPG' }), 'image/jpeg');
    assert.equal(resolveRecordImageMimeType({ type: 'application/octet-stream', name: 'a.png' }), 'image/png');
    assert.equal(resolveRecordImageMimeType({ type: '', name: 'notes.pdf' }), null);
    assert.equal(validateRecordImageFile({ type: '', size: 100, name: 'front.jpeg' }), null);
  });

  it('scopes object paths to table and record id', () => {
    const path = recordImageObjectPath('land_sales', 'rec-1', 'image/jpeg', 'abc');
    assert.equal(path, 'land_sales/rec-1/abc.jpg');
    assert.equal(isOwnedRecordImagePath(path, 'land_sales', 'rec-1'), true);
    assert.equal(isOwnedRecordImagePath(path, 'improved_sales', 'rec-1'), false);
    assert.equal(isOwnedRecordImagePath('../x', 'land_sales', 'rec-1'), false);
  });

  it('parses jsonb image arrays and drops broken entries', () => {
    assert.deepEqual(parseRecordImages([
      { path: 'land_sales/1/a.jpg', caption: ' A ' },
      { path: '', caption: 'skip' },
      { path: 'land_sales/1/a.jpg', caption: 'dup' },
      null,
      { path: 'land_sales/1/b.png' },
    ]), [
      { path: 'land_sales/1/a.jpg', caption: 'A' },
      { path: 'land_sales/1/b.png', caption: '' },
    ]);
  });

  it('falls back to legacy single path/caption columns', () => {
    assert.deepEqual(readRecordImagesFromRow({
      [RECORD_IMAGE_COLUMN]: 'land_sales/1/old.jpg',
      [RECORD_IMAGE_CAPTION_COLUMN]: 'Legacy',
    }), [{ path: 'land_sales/1/old.jpg', caption: 'Legacy' }]);
    assert.deepEqual(readRecordImagesFromRow({
      [RECORD_IMAGES_COLUMN]: [{ path: 'land_sales/1/new.jpg', caption: 'New' }],
      [RECORD_IMAGE_COLUMN]: 'land_sales/1/old.jpg',
    }), [{ path: 'land_sales/1/new.jpg', caption: 'New' }]);
  });

  it('applies caption updates by path', () => {
    assert.deepEqual(applyRecordImageCaptionUpdates(
      [
        { path: 'a.jpg', caption: 'Old' },
        { path: 'b.jpg', caption: 'Keep' },
      ],
      [{ path: 'a.jpg', caption: 'New' }],
    ), [
      { path: 'a.jpg', caption: 'New' },
      { path: 'b.jpg', caption: 'Keep' },
    ]);
  });

  it('appends and removes photos with a count cap', () => {
    const first = appendRecordImage([], { path: 'a.jpg', caption: '' });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.deepEqual(removeRecordImageAtPath(first.images, 'a.jpg'), []);
  });

  it('removes the previous object after a successful replace', () => {
    assert.deepEqual(recordImageObjectsToRemove({
      previousPath: 'land_sales/rec-1/old.jpg',
      table: 'land_sales',
      recordId: 'rec-1',
      newPath: 'land_sales/rec-1/new.jpg',
      rowUpdated: true,
    }), ['land_sales/rec-1/old.jpg']);
    assert.deepEqual(recordImageObjectsToRemove({
      previousPath: 'land_sales/rec-1/old.jpg',
      table: 'land_sales',
      recordId: 'rec-1',
      newPath: 'land_sales/rec-1/new.jpg',
      rowUpdated: false,
    }), ['land_sales/rec-1/new.jpg']);
  });
});
