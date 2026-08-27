/** Drift guard for the CoStar header contract (README §3A, Appendix A).
 *
 * README Appendix A is the contract; `COSTAR_HEADER_ROW` is its executable
 * copy. Four representations must agree — the README, this constant, the
 * creating migration, and the live `land_sales` columns — and nothing else
 * enforces it. These tests cover the two that live in the repository.
 *
 * The live database is checked out-of-band, since a unit test has no
 * credentials. Run this and expect 277 catalog names in canonical order plus
 * the `id` carve-out, and nothing else:
 *
 *   select json_agg(column_name order by ordinal_position)
 *   from information_schema.columns
 *   where table_schema = 'public' and table_name = 'land_sales';
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COSTAR_HEADER_ROW, COSTAR_HEADERS } from './costar-fields.ts';
import { costarColumnType, type CostarColumnType } from './costar-column-types.ts';

const README = readFileSync(fileURLToPath(new URL('../../README.md', import.meta.url)), 'utf8');

/** The fenced header row under "Appendix A", not merely the first fence in the
 * file — a later edit could add another one above it. */
function appendixHeaderRow(): string {
  const appendix = README.slice(README.indexOf('## Appendix A'));
  assert.notEqual(appendix, '', 'README is missing Appendix A');
  const fence = appendix.match(/```text\n([^\n]*)\n```/);
  assert.ok(fence, 'Appendix A is missing its fenced header row');
  return fence[1].trim();
}

/** Appendix A's typed-column bullets, e.g. `- **numeric** (22) — A, B, C`.
 * Bullets wrap across lines, so whitespace is collapsed before splitting. */
function appendixTypedColumns(label: string): string[] {
  const appendix = README.slice(README.indexOf('## Appendix A'));
  const bullet = appendix.match(new RegExp(`- \\*\\*${label}\\*\\*[^—]*—([\\s\\S]*?)(?=\\n- \\*\\*|\\n\\n)`));
  assert.ok(bullet, `Appendix A is missing the ${label} column list`);
  return bullet[1].replace(/\s+/g, ' ').trim().split(', ').filter(Boolean);
}

describe('CoStar header contract', () => {
  it('keeps COSTAR_HEADER_ROW byte-identical to README Appendix A', () => {
    assert.equal(
      COSTAR_HEADER_ROW,
      appendixHeaderRow(),
      'COSTAR_HEADER_ROW and README Appendix A have diverged. Appendix A is the contract — ' +
      'changing the catalog requires a decision under README §5, then migration + constant + Appendix A together.',
    );
  });

  it('holds 278 header positions and 277 distinct names', () => {
    assert.equal(COSTAR_HEADERS.length, 278);
    assert.equal(new Set(COSTAR_HEADERS).size, 277);
  });

  it('carries the Sprinklers duplicate at the two documented positions', () => {
    const positions = COSTAR_HEADERS.flatMap((h, i) => (h === 'Sprinklers' ? [i + 1] : []));
    assert.deepEqual(positions, [259, 260], 'Sprinklers must stay at positions 259 and 260 (README §3A)');
  });

  it('contains no app-invented identifier', () => {
    // The deprecated prototype renamed a subset of headers to snake_case ids.
    // A field is a header string; nothing in the catalog may look otherwise.
    const invented = COSTAR_HEADERS.filter(h => /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(h));
    assert.deepEqual(invented, [], 'Catalog headers must be CoStar header strings, never bespoke identifiers');
  });
});

describe('CoStar column types', () => {
  const expected = new Map<string, CostarColumnType>([
    ...appendixTypedColumns('numeric').map(c => [c, 'number'] as const),
    ...appendixTypedColumns('bigint').map(c => [c, 'number'] as const),
    ...appendixTypedColumns('timestamp').map(c => [c, 'date'] as const),
    ...appendixTypedColumns('boolean').map(c => [c, 'boolean'] as const),
  ]);

  it('lists only real catalog headers as typed', () => {
    const known = new Set<string>(COSTAR_HEADERS);
    const unknown = [...expected.keys()].filter(c => !known.has(c));
    assert.deepEqual(unknown, [], 'Appendix A types a column that is not in the header row');
  });

  it('classifies every documented typed column the same way README does', () => {
    const wrong = [...expected].flatMap(([column, kind]) => {
      const actual = costarColumnType(column);
      return actual === kind ? [] : [`${column}: README says ${kind}, code says ${actual}`];
    });
    assert.deepEqual(wrong, [], 'costar-column-types.ts disagrees with README Appendix A');
  });

  it('treats every other header as text', () => {
    const wrong = COSTAR_HEADERS.filter(h => !expected.has(h) && costarColumnType(h) !== 'text');
    assert.deepEqual(wrong, [], 'A column is typed in code but not documented in README Appendix A');
  });
});
