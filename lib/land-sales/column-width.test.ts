import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, defaultColumnWidth, draggedColumnWidth, keyboardColumnWidth } from './column-width.ts';

describe('column widths', () => {
  it('allows shrinking below the default header width and expanding by pointer distance', () => {
    const initial = defaultColumnWidth('Property Address');
    assert.equal(draggedColumnWidth(initial, 200, 180), initial - 20);
    assert.equal(draggedColumnWidth(initial, 200, 260), initial + 60);
    assert.equal(draggedColumnWidth(initial, 200, -200), MIN_COLUMN_WIDTH);
    assert.equal(draggedColumnWidth(initial, 200, 10000), MAX_COLUMN_WIDTH);
  });

  it('supports keyboard resizing, bounds, and unrelated keys', () => {
    assert.equal(keyboardColumnWidth(100, 'ArrowLeft'), 84);
    assert.equal(keyboardColumnWidth(100, 'ArrowRight'), 116);
    assert.equal(keyboardColumnWidth(MIN_COLUMN_WIDTH, 'ArrowLeft'), MIN_COLUMN_WIDTH);
    assert.equal(keyboardColumnWidth(MAX_COLUMN_WIDTH, 'ArrowRight'), MAX_COLUMN_WIDTH);
    assert.equal(keyboardColumnWidth(100, 'Home'), MIN_COLUMN_WIDTH);
    assert.equal(keyboardColumnWidth(100, 'End'), MAX_COLUMN_WIDTH);
    assert.equal(keyboardColumnWidth(100, 'Tab'), null);
  });
});
