# Bowery Valuation Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every textual occurrence of the former product name with `Bowery Valuation` while preserving internal identifiers, existing presentation, and unrelated working-tree changes.

**Architecture:** Make direct, minimal copy replacements in the three runtime sources, the checked-in design mockups, and the descriptive migration comment. Do not add a branding abstraction or rename internal identifiers. Use a repository-wide old-name scan as the red/green regression check, then verify with Next.js static checks and the live preview.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, static HTML design mockups, Supabase SQL migrations, PowerShell, ripgrep.

## Global Constraints

- Preserve surrounding component structure, typography, casing conventions, styles, and behavior.
- Do not rename package identifiers, repository paths, folders, database objects, migration filenames, or other internal identifiers.
- Preserve and exclude the pre-existing edits in `app/login/page.tsx`, `claude_design/Login.dc.html`, and `styles/design-system/industry.css` from rebrand-specific commits.
- Use `Bowery Valuation` in title case where the existing text is title case, and `BOWERY VALUATION` where the existing text is all caps.
- Read the installed Next.js metadata guide before editing `app/layout.tsx`: `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md`.

---

### Task 1: Rebrand runtime UI and metadata

**Files:**
- Modify: `app/layout.tsx:25-29`
- Modify: `components/auth/auth-card.tsx:25-29`
- Modify: `components/ui/nav-header.tsx:21-25`

**Interfaces:**
- Consumes: Existing `Metadata`, `AuthCard`, and `NavHeader` implementations.
- Produces: Browser metadata containing `Bowery Valuation` and runtime headings containing `BOWERY VALUATION`; no signature or data-flow changes.

- [ ] **Step 1: Run the failing runtime copy check**

Run:

```powershell
$runtimeFiles = @('app/layout.tsx', 'components/auth/auth-card.tsx', 'components/ui/nav-header.tsx')
$formerBrand = 'Vantage' + ' CRE'
rg -n -i $formerBrand $runtimeFiles
if ($LASTEXITCODE -eq 0) { Write-Error 'Former brand remains in runtime sources, as expected before implementation.'; exit 1 }
```

Expected: FAIL with matches in all three runtime files. This proves the check detects the behavior being changed.

- [ ] **Step 2: Read the installed Next.js metadata guidance**

Run:

```powershell
Get-Content -Raw 'node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md'
```

Expected: The installed Next.js 16.3 guide documents static metadata exported from a layout; no API or structural change is needed for a title-string replacement.

- [ ] **Step 3: Apply the minimal runtime replacements**

In `app/layout.tsx`, retain the existing `Metadata` object and change only the title:

```tsx
export const metadata: Metadata = {
  title: 'Bowery Valuation',
  description: 'Commercial real estate comp database',
};
```

In `components/auth/auth-card.tsx`, retain the existing heading element and styles:

```tsx
<div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--color-text)', lineHeight: 1.1 }}>
  BOWERY VALUATION
</div>
```

In `components/ui/nav-header.tsx`, retain the existing link and heading styles:

```tsx
<span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--color-accent-2-100)' }}>
  BOWERY VALUATION
</span>
```

- [ ] **Step 4: Run the runtime copy check and static validation**

Run:

```powershell
$runtimeFiles = @('app/layout.tsx', 'components/auth/auth-card.tsx', 'components/ui/nav-header.tsx')
$formerBrand = 'Vantage' + ' CRE'
rg -n -i $formerBrand $runtimeFiles
if ($LASTEXITCODE -eq 0) { Write-Error 'Former brand remains in runtime sources.'; exit 1 }
if ($LASTEXITCODE -gt 1) { exit $LASTEXITCODE }
npm run lint
npm run build
```

Expected: No old-brand matches; lint and build both exit 0. If existing unrelated work causes either command to fail, capture and report the exact failure rather than changing unrelated files.

- [ ] **Step 5: Verify the runtime branding in the collaborative preview**

Navigate to `http://localhost:3000/login` and confirm:

```text
Visible heading: BOWERY VALUATION
Document title: Bowery Valuation
Framework error overlay: absent
New console errors: absent
```

If an authenticated session is available, navigate to `/search` and confirm the header also reads `BOWERY VALUATION`. If authentication is unavailable, verify the compiled `NavHeader` source through the successful build and record that live authenticated header verification was blocked by the missing session.

- [ ] **Step 6: Commit only the runtime branding files**

Run:

```powershell
git add -- 'app/layout.tsx' 'components/auth/auth-card.tsx' 'components/ui/nav-header.tsx'
git diff --cached --check
git commit -m 'rebrand runtime UI as Bowery Valuation'
```

Expected: One commit containing only the three runtime source files.

---

### Task 2: Rebrand checked-in mockups and descriptive source text

**Files:**
- Modify: `claude_design/Database.dc.html:27`
- Modify: `claude_design/DatabaseManager.dc.html:27`
- Modify: `claude_design/DatabaseSchema.dc.html:27`
- Modify: `claude_design/LandSalesSearch.dc.html:27`
- Modify: `claude_design/RecordDetails.dc.html:28`
- Modify: `claude_design/SalesSearch.dc.html:27`
- Modify: `claude_design/Search.dc.html:27`
- Modify: `claude_design/UserProfile.dc.html:27`
- Modify: `supabase/migrations/20260811120000_reset_land_sales_schema.sql:2`

**Interfaces:**
- Consumes: Existing static design mockups and migration documentation.
- Produces: Supporting artifacts containing only the new product name; no runtime, schema, or migration behavior changes.

- [ ] **Step 1: Run the failing supporting-artifact check**

Run:

```powershell
$supportFiles = @(
  'claude_design/Database.dc.html',
  'claude_design/DatabaseManager.dc.html',
  'claude_design/DatabaseSchema.dc.html',
  'claude_design/LandSalesSearch.dc.html',
  'claude_design/RecordDetails.dc.html',
  'claude_design/SalesSearch.dc.html',
  'claude_design/Search.dc.html',
  'claude_design/UserProfile.dc.html',
  'supabase/migrations/20260811120000_reset_land_sales_schema.sql'
)
$formerBrand = 'Vantage' + ' CRE'
rg -n -i $formerBrand $supportFiles
if ($LASTEXITCODE -eq 0) { Write-Error 'Former brand remains in supporting artifacts, as expected before implementation.'; exit 1 }
```

Expected: FAIL with one match in every listed file.

- [ ] **Step 2: Apply the direct supporting-artifact replacements**

In each listed `.dc.html` file, retain the existing `<span>` and inline styles and replace only its text content:

```html
<span style="font-family: var(--font-heading); font-size: 20px; font-weight: 600; letter-spacing: 0.02em; color: var(--color-accent-2-100)">BOWERY VALUATION</span>
```

In `supabase/migrations/20260811120000_reset_land_sales_schema.sql`, change only the descriptive comment:

```sql
-- single-tenant land_sales table matching the new Bowery Valuation design mockups.
```

- [ ] **Step 3: Run the supporting-artifact and repository-wide green checks**

Run:

```powershell
$supportFiles = @(
  'claude_design/Database.dc.html',
  'claude_design/DatabaseManager.dc.html',
  'claude_design/DatabaseSchema.dc.html',
  'claude_design/LandSalesSearch.dc.html',
  'claude_design/RecordDetails.dc.html',
  'claude_design/SalesSearch.dc.html',
  'claude_design/Search.dc.html',
  'claude_design/UserProfile.dc.html',
  'supabase/migrations/20260811120000_reset_land_sales_schema.sql'
)
$formerBrand = 'Vantage' + ' CRE'
rg -n -i $formerBrand $supportFiles
if ($LASTEXITCODE -eq 0) { Write-Error 'Former brand remains in supporting artifacts.'; exit 1 }
if ($LASTEXITCODE -gt 1) { exit $LASTEXITCODE }

rg -n -i --hidden --glob '!node_modules/**' --glob '!.next/**' --glob '!.git/**' $formerBrand .
if ($LASTEXITCODE -eq 0) { Write-Error 'Former brand remains in the repository text scope.'; exit 1 }
if ($LASTEXITCODE -gt 1) { exit $LASTEXITCODE }
```

Expected: Both scans return no matches and the command exits 0.

- [ ] **Step 4: Review the complete scoped diff**

Run:

```powershell
git diff --check
git diff -- 'app/layout.tsx' 'components/auth/auth-card.tsx' 'components/ui/nav-header.tsx' 'claude_design/Database.dc.html' 'claude_design/DatabaseManager.dc.html' 'claude_design/DatabaseSchema.dc.html' 'claude_design/LandSalesSearch.dc.html' 'claude_design/RecordDetails.dc.html' 'claude_design/SalesSearch.dc.html' 'claude_design/Search.dc.html' 'claude_design/UserProfile.dc.html' 'supabase/migrations/20260811120000_reset_land_sales_schema.sql'
```

Expected: Only brand copy changes appear in the scoped files, with no whitespace errors. The pre-existing edits in `app/login/page.tsx`, `claude_design/Login.dc.html`, and `styles/design-system/industry.css` remain unstaged and unchanged by this plan.

- [ ] **Step 5: Commit only the supporting artifacts**

Run:

```powershell
git add -- 'claude_design/Database.dc.html' 'claude_design/DatabaseManager.dc.html' 'claude_design/DatabaseSchema.dc.html' 'claude_design/LandSalesSearch.dc.html' 'claude_design/RecordDetails.dc.html' 'claude_design/SalesSearch.dc.html' 'claude_design/Search.dc.html' 'claude_design/UserProfile.dc.html' 'supabase/migrations/20260811120000_reset_land_sales_schema.sql'
git diff --cached --check
git commit -m 'rebrand design artifacts as Bowery Valuation'
```

Expected: One commit containing only the eight mockups and the descriptive migration-comment change.

- [ ] **Step 6: Run final verification from the resulting commit state**

Run:

```powershell
$formerBrand = 'Vantage' + ' CRE'
rg -n -i --hidden --glob '!node_modules/**' --glob '!.next/**' --glob '!.git/**' $formerBrand .
if ($LASTEXITCODE -eq 0) { Write-Error 'Former brand remains in the repository text scope.'; exit 1 }
if ($LASTEXITCODE -gt 1) { exit $LASTEXITCODE }
npm run lint
npm run build
git status --short
```

Expected: No former-name matches; lint and build exit 0; status shows only the three pre-existing unrelated modified files.
