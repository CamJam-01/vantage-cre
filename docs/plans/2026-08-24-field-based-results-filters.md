# Field-Based Results Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Land Sales results sidebar relic filters with typed, visibility-aware CoStar field filters that apply only when the user clicks Apply Filters.

**Architecture:** A column-type catalog plus `FieldFilter` encode/decode live in `lib/land-sales`. `LandSaleFilters` gains optional `fieldFilters` (`ff` URL params) while legacy search-page params stay. The sidebar keeps a draft until Apply or Cancel. The query layer ANDs `ff` clauses onto the existing Supabase filter chain.

**Tech Stack:** Next.js App Router, React client sidebar, TypeScript, Supabase query builder, `node:test` via `node --experimental-strip-types --test`.

## Global Constraints

- Do not change the Modify Search page UI.
- Legacy URL params (`state`, `msa`, `county`, `city`, `type`, size, time) still filter results.
- Add Filter lists only `filterVisibleColumns` results; hidden fields never appear in the menu.
- Results and URL change only on Apply Filters; Cancel restores the last applied draft; closing the sidebar keeps the draft.
- Relic State / MSA / County / City / Type / Size / Time widgets are removed from the results sidebar.
- Do not commit unless the user asks.

---

### Task 1: Column type catalog

**Files:**
- Create: `lib/land-sales/costar-column-types.ts`
- Create: `lib/land-sales/costar-column-types.test.ts`

**Interfaces:**
- Produces: `CostarColumnType`, `costarColumnType(column: string): CostarColumnType`

- [ ] Test then implement `costarColumnType` using Postgres types from `land_sales`: numeric/bigint → `number`, timestamp → `date`, boolean → `boolean`, else `text`.

---

### Task 2: Field filter encode/decode, candidates, draft dirty-check

**Files:**
- Create: `lib/land-sales/field-filters.ts`
- Create: `lib/land-sales/field-filters.test.ts`

**Interfaces:**
- Produces: `FieldFilter`, `DraftFieldFilter`, `encodeFieldFilter`, `decodeFieldFilter`, `compactDraftFilters`, `appliedToDraft`, `draftsDiffer`, `addFilterCandidates`, `emptyDraftFilter`

- [ ] Tests for round-trip, malformed/duplicate `ff`, empty omission, candidates (visible minus drafted minus hidden + search), draftsDiffer including extra empty field.
- [ ] Implement.

---

### Task 3: Search params + query clauses

**Files:**
- Modify: `lib/land-sales/search-params.ts`
- Create: `lib/land-sales/search-params.test.ts`
- Modify: `lib/land-sales/query.ts`
- Create: `lib/land-sales/query.test.ts`

**Interfaces:**
- `LandSaleFilters.fieldFilters?: FieldFilter[]`
- `landSaleFilterClauses(filters): FilterClause[]`
- `applyLandSaleFilters` applies those clauses after legacy filters.

- [ ] Tests: encode/decode `ff` with leftover `state`; empty omitted; `hasAnyFilter` counts field filters; clauses AND text/number/date/boolean with legacy `state`/`sfMin`.
- [ ] Implement.

---

### Task 4: Sidebar + wiring

**Files:**
- Modify: `components/land-sales/filters-sidebar.tsx`
- Modify: `components/land-sales/results-table.tsx`
- Modify: `app/(app)/land-sales/page.tsx` (only if sidebar needs extra props that table already has — pass `columns` into `FiltersSidebar`)

- [ ] Rewrite sidebar: searchable Add Filter, typed controls, remove, Apply/Cancel disabled until dirty, draft persists on close.
- [ ] Pass visible `columns` from `ResultsTable`.
- [ ] Manual verify in browser.

---
