import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const SCAN_DIRS = ['app', 'components', 'lib'];
const SKIP_DIR_NAMES = new Set(['node_modules', '.claude', 'worktrees']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const FORBIDDEN = [
  { name: 'parcel_id', pattern: /\bparcel_id\b/ },
  { name: 'price_per_acre', pattern: /\bprice_per_acre\b/ },
  { name: 'COSTAR_CORE_HEADER_MAP', pattern: /COSTAR_CORE_HEADER_MAP/ },
  { name: 'DETAIL_SHEETS', pattern: /\bDETAIL_SHEETS\b/ },
  { name: 'landSaleInputSchema', pattern: /\blandSaleInputSchema\b/ },
  { name: 'extraInputName', pattern: /\bextraInputName\b/ },
  { name: 'catalogLabels', pattern: /\bcatalogLabels\b/ },
  { name: "kind: 'core'", pattern: /kind:\s*['"]core['"]/ },
];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(extname(entry))) continue;
    if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue;
    files.push(full);
  }
  return files;
}

describe('prototype field model', () => {
  it('does not remain in application source', () => {
    const hits: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const source = readFileSync(file, 'utf8');
        for (const rule of FORBIDDEN) {
          if (!rule.pattern.test(source)) continue;
          hits.push(`${relative(ROOT, file).replaceAll('\\', '/')} (${rule.name})`);
        }
      }
    }
    assert.deepEqual(hits, []);
  });
});
