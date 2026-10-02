export const MIN_COLUMN_WIDTH = 64;
export const MAX_COLUMN_WIDTH = 1600;

/** Keep default headings to two lines while leaving room for the sort icon. */
export function defaultColumnWidth(label: string): number {
  const tokens = label.split(/[\s/()-]+/).filter(Boolean);
  const longest = tokens.reduce((max, token) => Math.max(max, token.length), 1);
  const twoLineChars = Math.ceil(label.length / 2);
  return Math.max(96, Math.ceil(Math.max(longest, twoLineChars) * 7.2 + 36));
}

/** Bounded widths keep controls usable and prevent accidental oversized tables. */
export function clampColumnWidth(width: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));
}

export function draggedColumnWidth(startWidth: number, startX: number, pointerX: number): number {
  return clampColumnWidth(startWidth + pointerX - startX);
}

export function keyboardColumnWidth(width: number, key: string): number | null {
  switch (key) {
    case 'ArrowLeft': return clampColumnWidth(width - 16);
    case 'ArrowRight': return clampColumnWidth(width + 16);
    case 'Home': return MIN_COLUMN_WIDTH;
    case 'End': return MAX_COLUMN_WIDTH;
    default: return null;
  }
}
