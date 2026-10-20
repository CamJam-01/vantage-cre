import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { replaceRecordImageTags } from './docx-image.ts';

describe('replaceRecordImageTags', () => {
  it('replaces a sole-tag paragraph with a drawing when a relationship is provided', () => {
    const paragraph = '<w:p><w:r><w:t>{{ record_image }}</w:t></w:r></w:p>';
    const result = replaceRecordImageTags(paragraph, [{ relationshipId: 'rId9' }], 42);
    assert.match(result, /w:drawing/);
    assert.match(result, /r:embed="rId9"/);
    assert.equal(result.includes('record_image'), false);
  });

  it('stacks multiple drawings and captions for one tag', () => {
    const paragraph = '<w:p><w:r><w:t>{{ record_image }}</w:t></w:r></w:p>';
    const result = replaceRecordImageTags(paragraph, [
      { relationshipId: 'rId1', caption: 'Front' },
      { relationshipId: 'rId2', caption: 'Rear' },
    ], 1);
    assert.match(result, /r:embed="rId1"/);
    assert.match(result, /r:embed="rId2"/);
    assert.match(result, />Front</);
    assert.match(result, />Rear</);
  });

  it('blanks a sole-tag paragraph when there is no image', () => {
    const paragraph = '<w:p><w:r><w:t>{{ record_image }}</w:t></w:r></w:p>';
    assert.equal(replaceRecordImageTags(paragraph, null), '<w:p/>');
  });

  it('finds a tag split across runs', () => {
    const split = '<w:p><w:r><w:t>{{ rec</w:t></w:r><w:r><w:t>ord_image }}</w:t></w:r></w:p>';
    const result = replaceRecordImageTags(split, [{ relationshipId: 'rId2' }], 7);
    assert.match(result, /r:embed="rId2"/);
  });
});
