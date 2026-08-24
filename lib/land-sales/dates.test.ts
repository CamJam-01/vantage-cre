import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlexibleDate } from './dates.ts';

describe('parseFlexibleDate', () => {
  it('parses CoStar/Excel numeric dates with a trailing midnight timestamp', () => {
    assert.equal(parseFlexibleDate('8/13/2026 0:00'), '2026-08-13');
    assert.equal(parseFlexibleDate('8/6/2026 0:00'), '2026-08-06');
    assert.equal(parseFlexibleDate('06/30/2026 00:00'), '2026-06-30');
    assert.equal(parseFlexibleDate('6/18/2026 0:00:00'), '2026-06-18');
  });

  it('still parses numeric dates without a time component', () => {
    assert.equal(parseFlexibleDate('8/13/2026'), '2026-08-13');
    assert.equal(parseFlexibleDate('06-12-2026'), '2026-06-12');
  });

  it('still parses ISO dates with optional time', () => {
    assert.equal(parseFlexibleDate('2026-08-13'), '2026-08-13');
    assert.equal(parseFlexibleDate('2026-08-13 00:00:00'), '2026-08-13');
  });
});
