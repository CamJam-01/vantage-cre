import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AVATAR_MAX_BYTES,
  avatarExtension,
  avatarFileErrorMessage,
  avatarObjectPath,
  validateAvatarFile,
} from './avatar.ts';

describe('validateAvatarFile', () => {
  it('accepts a jpeg under the size limit', () => {
    assert.equal(validateAvatarFile({ type: 'image/jpeg', size: 120_000 }), null);
  });

  it('rejects a non-image file', () => {
    assert.equal(validateAvatarFile({ type: 'application/pdf', size: 120_000 }), 'type');
  });

  it('rejects an image over 2 MB', () => {
    assert.equal(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 }), 'size');
  });
});

describe('avatarFileErrorMessage', () => {
  it('explains allowed types', () => {
    assert.equal(avatarFileErrorMessage('type'), 'Use a JPEG, PNG, WebP, or GIF image.');
  });

  it('explains the size limit', () => {
    assert.equal(avatarFileErrorMessage('size'), 'Image must be 2 MB or smaller.');
  });
});

describe('avatarObjectPath', () => {
  it('stores the file under the user id with a unique name', () => {
    assert.equal(
      avatarObjectPath('user-123', 'image/webp', 'abc-def'),
      'user-123/abc-def.webp',
    );
  });

  it('maps jpeg to a jpg extension', () => {
    assert.equal(avatarExtension('image/jpeg'), 'jpg');
  });
});
