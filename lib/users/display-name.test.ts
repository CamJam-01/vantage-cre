import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { displayUserName } from './display-name.ts';

describe('displayUserName', () => {
  it('shows username when it differs from full_name', () => {
    assert.equal(
      displayUserName({ username: 'Cameron', full_name: 'Test Account' }),
      'Cameron',
    );
  });

  it('falls back to full_name when username is missing', () => {
    assert.equal(
      displayUserName({ username: null, full_name: 'Cody Jetton' }),
      'Cody Jetton',
    );
  });

  it('treats a blank username as missing and uses full_name', () => {
    assert.equal(
      displayUserName({ username: '   ', full_name: 'QA Tester' }),
      'QA Tester',
    );
  });

  it('falls back to an em dash when both names are missing', () => {
    assert.equal(
      displayUserName({ username: null, full_name: '' }),
      '—',
    );
  });
});
