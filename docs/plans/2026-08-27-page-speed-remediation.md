# Page Speed Remediation

Implements the nine findings from the 2026-08-27 performance audit, in ascending order of risk. Tasks are ordered so that every prerequisite lands before the task that depends on it.

**Execution model:** one task = one commit = one verification run. Do not batch tasks. Do not skip a `Verify` block. If a `Verify` fails, fix it before starting the next task — never carry a red check forward.

---

## Non-negotiable constraints

These come from `AGENTS.md` and `README.md`. Breaking one is worse than leaving the performance problem in place.

| Rule | Where |
| --- | --- |
| **Never add `use cache` or `cacheLife`.** Cache Components is off; every screen is per-user authenticated data. `React.cache()` is a *different thing* and is allowed — it is request-scoped only. | AGENTS.md §2.1 |
| **Never remove a role check from a Server Action.** Actions are reachable by direct POST. | AGENTS.md §2.5 |
| **Never introduce a service-role key.** Fix policies, don't route around RLS. | AGENTS.md §2.4 |
| **The catalog is closed.** No header added, removed, renamed, or reordered. | README §3A |
| **Export always emits all 278 positions.** Any change making an exported file fail to re-import must be raised first. | README §6.1 |
| **Search state lives in the URL** and decoding is *total* — malformed input yields a valid value, never a throw. | AGENTS.md §2.7 |
| `lib/` stays pure: no JSX, no `components/` imports, no `next/*` beyond types. | AGENTS.md §2.2 |
| Types: `type` aliases only, no `interface`, no `any`, exhaustive `never` default on union switches. | AGENTS.md §5 |
| Column identifiers are header strings verbatim — **always quote them** in queries. | AGENTS.md §3.1 |

**Do not commit or push unless asked.** Branch from `main` with a `fix/` or `update/` prefix.

---

## Verification commands

```bash
npx tsc --noEmit
```

```bash
npx next build
```

```bash
npm run lint
```

`npm run lint` currently reports **41 problems (14 errors)**, all pre-existing (mostly `react-hooks/set-state-in-effect`). That count must not increase. It is not a clean baseline — do not try to make it zero as part of this plan.

The test suite **cannot run as checked in** — there is no `test` script and no resolver hook, so plain `node --test` fails on every suite (AGENTS.md §7). A first-run `ERR_MODULE_NOT_FOUND` is the missing harness, not a broken change. Task 0 supplies it, because Tasks 2, 3, and 5 all require running tests.

---

## Task 0 — Check in the test harness

**Enabling work — not an audit finding.** Do this first only because Tasks 2, 3, and 5 ask you to write and run tests, and today nothing can run them.

`scripts/` exists in the repo but is **empty**. Test files import subjects with explicit `.ts` specifiers while those sources use Next-style extensionless imports, which Node's ESM resolver cannot follow. The fix is a resolve hook that retries failed relative specifiers with `.ts`/`.tsx` and delegates via `next()`.

### Steps

- [ ] **0a.** Add `scripts/resolve-ts.mjs` exporting an async `resolve(specifier, context, next)` that tries `next(specifier, context)` first, and on failure — only for specifiers starting with `.` — retries with `.ts` then `.tsx`, rethrowing the original error if neither resolves. Do **not** set `shortCircuit`; delegating through `next()` is what keeps Node's own type stripping running.
- [ ] **0b.** Add `scripts/register.mjs` that calls `register('./resolve-ts.mjs', import.meta.url)` from `node:module`.
- [ ] **0c.** Add a `test` script to `package.json`:

  ```
  node --experimental-strip-types --import ./scripts/register.mjs --test "lib/**/*.test.ts"
  ```

- [ ] **0d.** Update AGENTS.md §7, which currently states there is no configured test command. Leaving that stale would make the next agent re-derive the shim from scratch — the same reason README §5 requires docs to move with the change.

### Done when

`npm test` runs every existing suite. Record the pass/fail baseline in the commit message; **do not fix unrelated failing tests** as part of this plan.

### Verify

```bash
npm test
```

The drift guard `lib/land-sales/costar-contract.test.ts` must report **7/7 pass**.

---

## Task 1 — Deduplicate the auth round trips

**Finding 01 · Highest impact · Low risk**

Every page view makes three `GET /auth/v1/user` calls. `supabase.auth.getUser()` is never a local cookie read — `@supabase/auth-js` issues a network request on every invocation, with no memoization.

```
proxy.ts:21          getUser()                   ← serial, blocks render
layout.tsx:8         getUser() + users select    ┐ same request,
land-sales/page.tsx  getUser() + users select    ┘ same result, twice
```

### ⚠️ Read this before writing code

`React.cache()` memoizes on **argument identity**. `getCurrentUserProfile(supabase)` takes a client, and `app/(app)/layout.tsx:7` and `app/(app)/land-sales/page.tsx:19` each call `await createClient()` separately, producing **two different objects**. Wrapping only `getCurrentUserProfile` therefore dedupes *nothing*.

`createClient` must be wrapped first, so both callers receive the same instance. This is safe: the client is built from `await cookies()`, which is already request-scoped, and `React.cache` never shares across requests.

### Files

- `lib/supabase/server.ts`
- `lib/users/roles.ts`
- `app/page.tsx`

### Steps

- [ ] **1a.** In `lib/supabase/server.ts`, wrap the exported `createClient` in `cache` from `react`. Keep the body unchanged. Add a one-sentence comment saying why — request-scoped identity is what lets callers share one client, and it is not a data cache.
- [ ] **1b.** In `lib/users/roles.ts`, wrap `getCurrentUserProfile` in `cache`. Leave its signature alone so all 11 call sites keep working.
- [ ] **1c.** In `app/page.tsx`, delete the `getUser()` call and the `createClient()` above it; `redirect('/search')` unconditionally.

  Justification to put in the commit message, not a code comment: `proxy.ts` already redirects unauthenticated requests to `/login` before this page runs, and `/search` enforces its own auth through the `(app)` layout. This picks a redirect target — it is **not** an authorization decision, so AGENTS.md §2.6 is not in play.

- [ ] **1d.** Leave `proxy.ts` exactly as it is. Its `getUser()` is the session refresh and the gate; it runs in a different context and cannot share the memo.

### Done when

- `/land-sales` performs **one** `GET /auth/v1/user` from the render pass (down from two) plus the proxy's, and **one** `users` select (down from two).
- No `use cache` or `cacheLife` anywhere in the diff.
- No call site of `getCurrentUserProfile` or `createClient` changed shape.

### Verify

```bash
npx tsc --noEmit && npx next build
```

Then, against `next dev` — connect to the running server, do not start a second one (AGENTS.md §8) — load `/land-sales` and confirm the profile query fires once per navigation.

---

## Task 2 — Stop downloading the table to build a duplicate key

**Finding 02 · 75× payload reduction · Low risk**

`importLandSales` reads every column of every row, then runs `landSaleFromRow` on each just to read three fields.

```
now       select('*')     1660 kB
needed    3 columns         22 kB
```

### Files

- `app/(app)/land-sales/actions.ts` (~line 181)

### Steps

- [ ] **2a.** Replace the `select('*')` in `importLandSales` with a select of only the three columns `recordKey` reads: `Parcel Number 1 (Min)`, `Sale Date`, `Property Address`. Quote every identifier.
- [ ] **2b.** Drop the `landSaleFromRow` call from that loop. `recordKey` takes a plain `Record<string, unknown>` and the raw row already carries those keys, so pass the row straight in.
- [ ] **2c.** Export the three column names as a single constant from `lib/land-sales/csv.ts`, beside `recordKey`, and build both the select string and the key from it. Two hand-maintained lists would drift, and AGENTS.md §3.1 forbids a second field list.
- [ ] **2d.** Add a test in `lib/land-sales/csv.test.ts` asserting the constant's members are all real catalog headers (`COSTAR_HEADERS.includes(...)`) and that `recordKey` reads exactly those three.

### Do not

Do not touch `updateLandSale`'s `select('*')` at line ~70. It is **correct** — `mergeVisibleUpdate` needs the hidden columns in order to preserve them. Removing it would silently drop data on every edit.

### Done when

The duplicate check transfers three columns, the import round trip still rejects mismatched headers, and duplicate detection returns identical results to before.

### Verify

```bash
npx tsc --noEmit && npx next build
```

Manual, and required — this is the write path: import a CSV containing a known-duplicate row and confirm it is still flagged and still halts for confirmation. Then import a fresh row and confirm it inserts.

---

## Task 3 — Hoist the catalog out of the row loops

**Finding 05 · −29% mapping cost · Low risk**

`costarColumnNames()` allocates a fresh `Set` of 277 strings per call, and it is called **once per row** by both `landSaleFromRow` and `landSaleToRow`. A results page builds 196 identical Sets; a 5,000-row import builds 5,000.

```
current (rebuilds per row)   11.99 ms   (196 rows, 200 iterations)
catalog hoisted once          8.46 ms
                             ──────
overhead                      3.53 ms   = 29% of mapping cost
```

### Files

- `lib/land-sales/costar-fields.ts`
- `lib/land-sales/result-columns.ts`

### Steps

- [ ] **3a.** In `costar-fields.ts`, compute the default results once at module level and return them when the function is called with no argument:

  ```ts
  const DEFAULT_COLUMN_NAMES: readonly string[] = [...new Set(COSTAR_HEADERS)];

  export function costarColumnNames(headers?: readonly string[]): string[] {
    if (!headers) return [...DEFAULT_COLUMN_NAMES];
    return [...new Set(headers)];
  }
  ```

  Keep returning a fresh array — callers may mutate. The saving is the `Set` construction over 278 strings, not the array copy. Do the same for `costarFields()`.

- [ ] **3b.** In `result-columns.ts`, hoist `resultColumns()` the same way.
- [ ] **3c.** Confirm the parameterized form still works. Verified at plan time: no call site in `app/`, `components/`, `lib/`, or any test passes an explicit argument, so the default path is the only live one — but the parameter is part of the signature and must keep behaving.

### Done when

Behaviour is byte-identical and the existing `lib/land-sales/costar-contract.test.ts` drift guard still passes untouched. If that guard needed editing, the change was wrong — revert and rethink.

### Verify

```bash
npx tsc --noEmit && npx next build
```

Run the drift guard and confirm **7/7 pass** with no edits to the test file.

---

## Task 4 — Narrow two remaining over-fetches

**Finding 07 · Low risk**

### Files

- `app/(app)/land-sales/actions.ts` (~line 104)
- `lib/land-sales/query.ts` (~line 98)
- one new migration under `supabase/migrations/`

### Steps

- [ ] **4a.** In `deleteLandSale`, replace `select('*')` with a select of just `Property Address` and `Parcel Number 1 (Min)` — the only fields `recordLabel` reads. Quote both.
- [ ] **4b.** `getDistinctSecondaryTypes` is already column-narrow; the waste is that it reads **every row** to produce a handful of dropdown values. Add a `SECURITY DEFINER` SQL function returning the distinct non-empty values, and call it via `supabase.rpc(...)`.

  The migration must: be additive and idempotent, carry a header comment explaining *why*, gate on `current_user_active()` so it cannot leak data to suspended or signed-out callers, and end with `notify pgrst, 'reload schema';` (AGENTS.md §4).

- [ ] **4c.** Keep `getDistinctSecondaryTypes`'s exported signature and return type unchanged so `app/(app)/search/sales/land/page.tsx` needs no edit.

### Do not

Do not add an index in this task. At 196 rows the planner will ignore it — indexing belongs with Task 5, where pagination makes it meaningful.

### Done when

The land search page still populates its Secondary Type filter with the same sorted, de-duplicated values, and deleting a record still writes an audit entry with the same label.

### Verify

```bash
npx tsc --noEmit && npx next build
```

Load `/search/sales/land` and confirm the type list is unchanged from before the migration.

---

## Task 5 — Paginate the results query

**Finding 04 · Removes a hard failure · Medium risk — changes what the user sees**

No query in the app has a row limit, and the `authenticated` role carries an **8-second statement timeout**. Growth does not degrade `/land-sales` gradually — past some row count the query is killed and `page.tsx:25` throws, turning results into an error page. Payload grows at ~8.5 kB per row.

### Design decision — settled, do not re-litigate

**`page` does not go into `LandSaleFilters`.** Add it as a separate search param with its own total decoder.

Reason: `appliedFilterCount` and `hasAnyFilter` drive the "N active" badge and the empty-state copy. Folding a page number into the filter type would make page 2 register as an applied filter. Keeping it separate also leaves `encodeFilters`/`decodeFilters` round-trip tests untouched.

### Files

- `lib/land-sales/search-params.ts`
- `lib/land-sales/query.ts`
- `app/(app)/land-sales/page.tsx`
- `components/land-sales/results-table.tsx`
- new: `lib/land-sales/pagination.ts` + `lib/land-sales/pagination.test.ts`

### Steps

- [ ] **5a.** Create `lib/land-sales/pagination.ts` with a page size constant, `decodePage(input): number` and `encodePage(page): string | null`. `decodePage` must be **total**: `?page=abc`, `?page=-4`, `?page=0`, `?page=99.5`, and a missing param all yield `1`. Never throw. Never return a non-integer.
- [ ] **5b.** Write `lib/land-sales/pagination.test.ts` covering every malformed input above plus a round trip. This is the AGENTS.md §2.7 totality rule — it gets a test.
- [ ] **5c.** In `query.ts`, add `.range(from, to)` and request an exact count. Keep `applyLandSaleFilters` usable by the import duplicate path, which needs a count without a range — do not force pagination onto that caller.
- [ ] **5d.** In `page.tsx`, read the page from `searchParams`, pass records plus total count and current page to `ResultsTable`.
- [ ] **5e.** In `results-table.tsx`, add pager controls in the existing header strip. Use the Industry system's own `.btn` classes and tokens — no hard-coded hex, font, or pixel value the tokens already carry (AGENTS.md §6). The record count line must now read as "showing X–Y of N", not `records.length`.
- [ ] **5f.** Add indexes on `Sale Date`, `Property State`, and `Secondary Type` in an additive migration. Now they are worth having: the sort and the two most common filters are what pagination will hit repeatedly.

### ⚠️ Known interaction — call it out in the PR

Client-side sort and select-all now operate on **the current page only**, not the whole result set. That is a genuine behaviour change. It is acceptable and expected, but say so explicitly rather than letting a reviewer discover it. If whole-set sorting is required, that is server-side sorting and a **separate** piece of work — do not smuggle it into this task.

### Done when

A filtered URL with a page number survives a reload and a paste into another browser, the pager round-trips losslessly, and no malformed `page` value can produce an error page.

### Verify

```bash
npx tsc --noEmit && npx next build
```

Run the new pagination test. Then, against `next dev`: paginate, reload mid-set, hand-edit `?page=` to `abc`, `-1`, and `999999` and confirm each renders a valid page rather than throwing.

---

## Task 6 — Stream the results shell

**Finding 08 · Medium risk**

Every page awaits its full `Promise.all` before sending anything, so the slowest query gates the entire screen. There are zero `Suspense` boundaries app-wide.

### Files

- `app/(app)/land-sales/page.tsx`
- new: a server child component holding the records fetch

### Steps

- [ ] **6a.** Split the records fetch into its own async Server Component. Leave the profile and display-settings reads in the page — they are fast and the chrome needs them.
- [ ] **6b.** Wrap that child in `Suspense` with a fallback matching the existing `loading.tsx` visual language: `--color-accent-2-100` ground, `--color-neutral-600` text, tokens only.
- [ ] **6c.** Keep the existing `Promise.all` batching for the reads that remain. It is correct — this adds streaming around it, it does not replace it.

### Do not

Do not add `use cache` or `cacheLife` while working in these files. Streaming and caching are unrelated; AGENTS.md §2.1 forbids the latter outright.

### Done when

The header, filter chrome, and export controls paint before the record rows resolve, and `loading.tsx` still covers the full-navigation case.

### Verify

```bash
npx tsc --noEmit && npx next build
```

Against `next dev` with network throttling: confirm the shell paints first and no layout shift occurs when rows arrive.

---

## Task 7 — 🛑 STOP: server-side export, then trim the payload

**Finding 03 · Highest payload win · Requires a decision before any code**

```
all 277 columns    1660 kB
82 visible          566 kB    ← 65.9% never rendered
```

**Do not start this task from the plan alone.**

`ResultsTable` builds CSV **client-side** via `makeCsv(selected)`, and export must emit all 278 header positions in canonical order. That is why the full record — all 277 columns, including the 195 an admin has hidden — is serialized into the RSC payload today. Trimming the payload to visible fields would make export emit blanks for hidden columns, and **an exported file would no longer re-import intact**.

That is the system's central constraint (README §6.1) and CLAUDE.md names it explicitly: *"If a change would make an exported file fail to re-import, raise it before building."*

### Required before implementation

- [x] **7a.** Export moves server-side. Client-side CSV is faster for a handful of already-loaded rows, but after pagination those rows do not include hidden columns (and cannot include unchecked pages). A Viewer-gated `POST /land-sales/export` re-fetches full catalog rows by selected uuid and returns the same `makeCsv` bytes.
- [x] **7b.** Export stays Viewer-level: `landSaleExportDeniedMessage` gates on an active session, not `canEdit`.
- [x] **7c.** No id ceiling in product terms. Selection is a Set of uuids held in the authenticated layout so checks persist across pages. The header checkbox toggles the current page only. Export POSTs that set; the handler chunks `.in('id', …)` so PostgREST URL limits are not a user-facing cap.

### Only after all three are answered

- [x] **7d.** Implement the server-side export, verifying against `lib/land-sales/csv.test.ts` that output is byte-identical to `makeCsv` for the same records.
- [x] **7e.** Add a round-trip test in **both directions** — export from here, re-import here, record survives unchanged (AGENTS.md §3.3). Include a record with values in hidden fields; that is exactly what this change risks.
- [x] **7f.** Only once 7e passes, trim `landSaleFromRow`'s output in the results path to visible columns. Keep the full mapping for the record detail and update paths, which need every column.

### Done when

An export produced after the change re-imports byte-identically, including hidden-field values, and the results payload drops to roughly 566 kB at current row counts.

---

## Summary

| # | Task | Measured win | Risk |
| --- | --- | --- | --- |
| 0 | Check in the resolver shim + `test` script | Makes Tasks 2/3/5 verifiable | Low — enabling work |
| 1 | `cache()` on client + profile; drop redundant `getUser` | −2 auth round trips/view | Low |
| 2 | Import duplicate check selects 3 columns | 1660 kB → 22 kB | Low |
| 3 | Hoist catalog constants out of row loops | −29% mapping cost | Low |
| 4 | Narrow delete-label and distinct-types reads | −2 full-table reads | Low |
| 5 | Paginate results, URL-encoded | Removes the 8 s cliff | Medium — UX change |
| 6 | Suspense boundary around results | Earlier first paint | Medium |
| 7 | Server-side export, then trim payload | 1660 kB → 566 kB | **Blocked on decision** |

Task 0 lands on its own — it touches tooling and AGENTS.md, nothing in the app. Tasks 1–4 are mechanical removals with no behaviour change and no scope question; they can land as a single PR. Tasks 5 and 6 change what the user sees and deserve their own PRs. Task 7 does not begin until 7a–7c are answered.

### Explicitly out of scope

Findings the audit checked and **closed** — do not "fix" these:

- **RLS policy functions.** `EXPLAIN ANALYZE` shows `current_user_active()` hoisted to a `One-Time Filter`, evaluated once per statement. The usual Supabase `(select ...)` rewrite would change nothing.
- **Indexes ahead of pagination.** The results query is a seq scan plus quicksort in 0.516 ms; planning costs more than execution. Indexes arrive in Task 5f, not before.
- **Table virtualization.** Pagination caps rows at the source and needs no new dependency. AGENTS.md §6 rules out adding a component library.
- **The always-mounted filters sidebar.** Hidden with `inert` and CSS rather than unmounted — a deliberate accessibility and transition trade-off, not a defect.
- **The 41 pre-existing lint problems.** Unrelated to this work. Separate pass.
