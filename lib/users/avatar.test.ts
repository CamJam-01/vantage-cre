import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  avatarExtension,
  avatarFileErrorMessage,
  avatarObjectPath,
  avatarObjectsToRemove,
  createAvatarUploadLock,
  validateAvatarFile,
} from './avatar.ts';

function publicAvatarUrl(path: string): string {
  return `https://example.supabase.co/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}

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

describe('createAvatarUploadLock', () => {
  it('refuses a second acquire while the first upload is still held', async () => {
    const lock = createAvatarUploadLock();
    const started: number[] = [];

    async function upload(id: number) {
      if (!lock.tryAcquire()) return;
      started.push(id);
      await Promise.resolve();
      lock.release();
    }

    const first = upload(1);
    await upload(2);
    await first;

    assert.deepEqual(started, [1]);
  });

  it('allows another upload after the in-flight one is released', async () => {
    const lock = createAvatarUploadLock();
    assert.equal(lock.tryAcquire(), true);
    lock.release();
    assert.equal(lock.tryAcquire(), true);
  });
});

describe('avatarObjectsToRemove', () => {
  const userId = 'user-123';
  const previousPath = `${userId}/old.webp`;
  const newPath = `${userId}/new.png`;

  it('deletes the previous owned object after a successful replace', () => {
    assert.deepEqual(
      avatarObjectsToRemove({
        previousUrl: publicAvatarUrl(previousPath),
        userId,
        newPath,
        profileUpdated: true,
      }),
      [previousPath],
    );
  });

  it('deletes the newly uploaded object when the profile update fails', () => {
    assert.deepEqual(
      avatarObjectsToRemove({
        previousUrl: publicAvatarUrl(previousPath),
        userId,
        newPath,
        profileUpdated: false,
      }),
      [newPath],
    );
  });

  it('ignores a previous URL that is not this user\'s avatars object', () => {
    assert.deepEqual(
      avatarObjectsToRemove({
        previousUrl: publicAvatarUrl('other-user/old.webp'),
        userId,
        newPath,
        profileUpdated: true,
      }),
      [],
    );
  });

  it('does not delete the new object when it is also the previous path', () => {
    assert.deepEqual(
      avatarObjectsToRemove({
        previousUrl: publicAvatarUrl(newPath),
        userId,
        newPath,
        profileUpdated: true,
      }),
      [],
    );
  });
});
