import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { feedbackSubmitterName } from './feedback-name.ts';

describe('feedbackSubmitterName', () => {
  it('pre-fills the username when there is one', () => {
    assert.equal(
      feedbackSubmitterName({ username: 'Cameron', full_name: 'Test Account' }),
      'Cameron',
    );
  });

  it('trims surrounding whitespace off the username', () => {
    assert.equal(
      feedbackSubmitterName({ username: '  Cameron  ', full_name: null }),
      'Cameron',
    );
  });

  it('falls back to full_name when username is missing', () => {
    assert.equal(
      feedbackSubmitterName({ username: null, full_name: 'Cody Jetton' }),
      'Cody Jetton',
    );
  });

  it('treats a blank username as missing and uses full_name', () => {
    assert.equal(
      feedbackSubmitterName({ username: '   ', full_name: 'QA Tester' }),
      'QA Tester',
    );
  });

  it('yields null rather than a placeholder when both names are missing', () => {
    assert.equal(feedbackSubmitterName({ username: null, full_name: '' }), null);
  });
});
