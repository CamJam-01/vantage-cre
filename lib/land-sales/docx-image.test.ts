import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { replaceRecordImageTags } from './docx-image.ts';

describe('replaceRecordImageTags', () => {
  it('replaces a sole-tag paragraph with a drawing when a relationship is provided', () => {
    const paragraph = '<w:p><w:r><w:t>{{ record_image }}</w:t></w:r></w:p>';
    const result = replaceRecordImageTags(paragraph, 'rId9', 42);
    assert.match(result, /w:drawing/);
    assert.match(result, /r:embed="rId9"/);
    assert.equal(result.includes('record_image'), false);
  });

  it('blanks a sole-tag paragraph when there is no image', () => {
    const paragraph = '<w:p><w:r><w:t>{{ record_image }}</w:t></w:r></w:p>';
    assert.equal(replaceRecordImageTags(paragraph, null), '<w:p/>');
  });

  it('finds a tag split across runs', () => {
    const split = '<w:p><w:r><w:t>{{ rec</w:t></w:r><w:r><w:t>ord_image }}</w:t></w:r></w:p>';
    const result = replaceRecordImageTags(split, 'rId2', 7);
    assert.match(result, /r:embed="rId2"/);
  });
});
