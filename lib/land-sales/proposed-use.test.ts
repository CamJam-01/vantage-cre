import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  proposedUseOverlaps,
  splitProposedUseLabels,
  uniqueProposedUseLabels,
} from './proposed-use.ts';

describe('splitProposedUseLabels', () => {
  it('splits comma-separated labels and trims whitespace', () => {
    assert.deepEqual(splitProposedUseLabels('Retail, Office'), ['Retail', 'Office']);
    assert.deepEqual(splitProposedUseLabels('  Retail ,  Office  '), ['Retail', 'Office']);
  });

  it('drops empty fragments and dedupes', () => {
    assert.deepEqual(splitProposedUseLabels('Retail,, Retail, '), ['Retail']);
    assert.deepEqual(splitProposedUseLabels(''), []);
    assert.deepEqual(splitProposedUseLabels('   ,  , '), []);
  });

  it('leaves slashes inside a single label', () => {
    assert.deepEqual(splitProposedUseLabels('Flex/R&D, Retail'), ['Flex/R&D', 'Retail']);
  });
});

describe('uniqueProposedUseLabels', () => {
  it('flattens combined cells into a sorted unique list', () => {
    assert.deepEqual(
      uniqueProposedUseLabels(['Retail, Office', ' Industrial ', 'Office', '']),
      ['Industrial', 'Office', 'Retail'],
    );
  });
});

describe('proposedUseOverlaps', () => {
  it('matches when any selected label is a whole token', () => {
    assert.equal(proposedUseOverlaps('Retail, Office', ['Office']), true);
    assert.equal(proposedUseOverlaps('Retail, Office', ['Industrial']), false);
    assert.equal(proposedUseOverlaps('Retail, Office', ['Retail', 'Industrial']), true);
  });

  it('does not treat a substring of a different token as a match', () => {
    assert.equal(proposedUseOverlaps('Office Warehouse', ['Office']), false);
    assert.equal(proposedUseOverlaps('Office Warehouse', ['Office Warehouse']), true);
  });

  it('treats an empty selection as a match and empty cells as a miss', () => {
    assert.equal(proposedUseOverlaps('Retail', []), true);
    assert.equal(proposedUseOverlaps(null, ['Retail']), false);
    assert.equal(proposedUseOverlaps('', ['Retail']), false);
  });
});
