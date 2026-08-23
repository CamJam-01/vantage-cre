import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const SCAN_DIRS = ['app', 'components', 'lib'];
const SKIP_DIR_NAMES = new Set(['node_modules', '.claude', 'worktrees']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

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

const INSERT_PATTERNS = [
  /from\(\s*['"]land_sales_custom_fields['"]\s*\)[\s\S]{0,120}\.(insert|upsert)\s*\(/,
  /insert\s+into\s+(?:public\.)?land_sales_custom_fields/i,
  /upsert\s+into\s+(?:public\.)?land_sales_custom_fields/i,
];

describe('custom field catalog writes', () => {
  it('has no application code that inserts or upserts land_sales_custom_fields', () => {
    const hits: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const source = readFileSync(file, 'utf8');
        if (!INSERT_PATTERNS.some(pattern => pattern.test(source))) continue;
        hits.push(relative(ROOT, file).replaceAll('\\', '/'));
      }
    }
    assert.deepEqual(hits, []);
  });
});
