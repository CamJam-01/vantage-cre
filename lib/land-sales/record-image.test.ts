import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECORD_IMAGE_CAPTION_COLUMN,
  RECORD_IMAGE_COLUMN,
  isOwnedRecordImagePath,
  normalizeRecordImageCaption,
  recordImageObjectPath,
  recordImageObjectsToRemove,
  validateRecordImageFile,
} from './record-image.ts';

describe('record-image', () => {
  it('keeps the storage columns outside the catalog name space', () => {
    assert.equal(RECORD_IMAGE_COLUMN.startsWith('_'), true);
    assert.equal(RECORD_IMAGE_CAPTION_COLUMN.startsWith('_'), true);
  });

  it('normalizes captions to trimmed text or undefined', () => {
    assert.equal(normalizeRecordImageCaption('  Facing north  '), 'Facing north');
    assert.equal(normalizeRecordImageCaption('   '), undefined);
    assert.equal(normalizeRecordImageCaption(null), undefined);
  });

  it('accepts common image types under the size cap', () => {
    assert.equal(validateRecordImageFile({ type: 'image/png', size: 1024 }), null);
    assert.equal(validateRecordImageFile({ type: 'application/pdf', size: 1024 }), 'type');
    assert.equal(validateRecordImageFile({ type: 'image/png', size: 6 * 1024 * 1024 }), 'size');
  });

  it('scopes object paths to table and record id', () => {
    const path = recordImageObjectPath('land_sales', 'rec-1', 'image/jpeg', 'abc');
    assert.equal(path, 'land_sales/rec-1/abc.jpg');
    assert.equal(isOwnedRecordImagePath(path, 'land_sales', 'rec-1'), true);
    assert.equal(isOwnedRecordImagePath(path, 'improved_sales', 'rec-1'), false);
    assert.equal(isOwnedRecordImagePath('../x', 'land_sales', 'rec-1'), false);
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
