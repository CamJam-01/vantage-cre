/** CoStar stores multiple proposed uses in one text cell, comma-separated.
 * Slashes stay inside a label (`Flex/R&D`) so they are not treated as separators. */

export function splitProposedUseLabels(raw: string): string[] {
  return [...new Set(
    raw.split(',')
      .map(part => part.trim())
      .filter(Boolean),
  )];
}

/** Flatten many stored cells into the sorted unique chip list shown on search. */
export function uniqueProposedUseLabels(rawValues: readonly string[]): string[] {
  const labels = new Set<string>();
  for (const raw of rawValues) {
    for (const label of splitProposedUseLabels(raw)) labels.add(label);
  }
  return [...labels].sort((a, b) => a.localeCompare(b));
}

/** True when any selected chip is a whole token in the stored cell.
 * Same OR semantics as Secondary Type's `.in()`: one matching label is enough. */
export function proposedUseOverlaps(
  raw: string | null | undefined,
  selected: readonly string[],
): boolean {
  if (!selected.length) return true;
  const labels = new Set(splitProposedUseLabels(raw ?? ''));
  return selected.some(label => labels.has(label));
}
