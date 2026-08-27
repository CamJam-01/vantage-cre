<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Engineering guide

**[`README.md`](README.md) is the single source of truth for *what* this product is, who it serves, and what is in or out of scope.** Read it before this file and before writing code. This file covers *how* to build here: architecture, constraints, and conventions. Where this file and the README appear to disagree about intent, the README wins and the disagreement is a defect in this file — fix it.

**If a request asks for something the README does not already describe as built, that is a scope question, not an implementation question.** Stop and confirm before writing code, and if the expansion is agreed, amend the README as part of the same change. The procedure is in README §5, "Changing this scope."

Section references below like "README §6.1" point into that document.

---

## 1. Stack

| | |
| --- | --- |
| Framework | Next.js **16.3** (App Router) |
| UI | React **19.2** |
| Language | TypeScript **6.0**, `strict` |
| Validation | Zod **4** |
| Data | Supabase — Postgres + Auth + Storage (`@supabase/ssr` 0.12, `@supabase/supabase-js` 2.x) |
| Icons | `lucide-react` |
| Host | Vercel |

`package.json` pins every dependency to `latest`. The versions above are what is currently installed — **check the installed version before relying on any API**, and do not assume a lockfile-stable world.

### Next 16 facts that contradict older training data

Confirm anything else against `node_modules/next/dist/docs/`, not memory.

- **Middleware is now Proxy.** The root file is `proxy.ts`, exporting `proxy()` plus a `config.matcher`. One per project. (`01-app/01-getting-started/16-proxy.md`)
- **`params` and `searchParams` are Promises.** Await them in every page and layout.
- **Cache Components is off** — `cacheComponents` is not set in `next.config.ts`, so the previous caching model applies. **Do not add `use cache` or `cacheLife` to this codebase.** Every screen renders per-user, per-request, authenticated data; caching it is a correctness and privacy bug, not an optimization. If Cache Components is ever adopted, every data path here is uncached-and-streamed by default.
- Docs are bundled and version-matched at `node_modules/next/dist/docs/`. No network lookup needed.

---

## 2. Architecture

### 2.1 Layers, and the one dependency rule

```
lib/                    pure domain logic — the product's actual rules
  └ lib/supabase/       data access (request-scoped clients)
app/**/page.tsx         Server Components — fetch, authorize, compose
app/**/actions.ts       Server Actions — the entire write path
components/             presentation; 'use client' only at interactive leaves
```

**Dependencies point inward only.** `lib/` never imports from `components/` or `app/`. Nothing outside `lib/supabase/` opens a database connection.

### 2.2 `lib/` is where the product lives

The single most important convention in this repository: **logic that can be a pure function must be a pure function in `lib/`, with a colocated test.** Components render; they do not decide.

Belongs in `lib/`: the field catalog, record ⟷ row mapping, validation, filter encoding/decoding, query-clause construction, arrangement resolution, permission predicates, formatting.

Must never appear in `lib/`: JSX, imports from `components/`, imports from `next/*` beyond types.

The payoff is that the rules in README §6 are testable without a browser, a database, or a render. Preserve that. When you find yourself writing a conditional inside a component that encodes a *domain* rule, it belongs in `lib/` instead.

### 2.3 Server by default

Pages are Server Components. They fetch, authorize, and pass **serializable props** down. `'use client'` goes at interactive leaves — a table, a form, a menu — never on a page or layout unless the entire screen is genuinely interactive.

Fetch independent reads concurrently; the established shape is:

```ts
const [{ data, error }, profile, display] = await Promise.all([...]);
```

### 2.4 The Supabase client boundary

- `lib/supabase/server.ts` — request-scoped, cookie-bound. Server Components and Server Actions **only**.
- `lib/supabase/client.ts` — browser.

Never import the server client into a Client Component. Consider adding `import 'server-only'` to server-only modules; the package is not currently installed, and adding it is a welcome hardening.

**Only the anonymous key is ever used. Row Level Security is the enforcement boundary.** There is no service-role key in this application. Do not introduce one to work around a permissions failure — fix the policy. A service-role key on a request path would silently defeat every access control in the system.

### 2.5 Server Actions are the entire write path

All mutations live in `'use server'` files under `app/**/actions.ts`.

**Every action begins by resolving the caller and checking authorization**, before touching data:

```ts
const denied = await landSaleWriteDeniedMessage(supabase);
if (denied) return { ok: false, error: denied };
```

This is not defensive style; it is required. The Next.js docs are explicit: *"Server Functions are reachable via direct POST requests, not just through your application's UI. Always verify authentication and authorization inside every Server Function."* Disabling a button protects nobody. This is README §6.4, and it is the rule most likely to be quietly broken by a plausible-looking change.

Also:
- Return a typed form-state object for user-correctable failures. Reserve `throw` for genuine faults.
- Write an audit entry after a successful mutation (§3.5).
- `revalidatePath` and/or `redirect` after a successful write.
- `next.config.ts` raises the action body limit to 3 MB for CSV import — keep import payloads within it.

### 2.6 `proxy.ts` is an optimistic gate only

The root proxy redirects unauthenticated requests to `/login` and signed-in users away from the auth screens. That is *all* it may do. Per the Next docs, Proxy "should not be used as a full session management or authorization solution" — it runs on every route including prefetches, so it must not query the database or make role decisions. Role enforcement happens at the point of execution (§2.5).

### 2.7 The URL is the search state container

A filter set must be fully expressible in the query string, and `encodeFilters` / `decodeFilters` must round-trip losslessly. Decoding is **total**: any malformed, stale, or hand-edited parameter yields a valid filter set, never a thrown error — a bad link renders a page. Never introduce search state that cannot survive a reload or be pasted to a colleague.

---

## 3. Data rules

The technical expression of README §6. Everything here is testable, and everything here should have a test.

### 3.1 The catalog and the schema are the same thing

`COSTAR_HEADER_ROW` in `lib/land-sales/costar-fields.ts` is the source of truth: **278 headers, 277 unique columns** (`Sprinklers` appears twice; Postgres cannot, so both headers share one column).

`land_sales` column names are the provider's header strings **verbatim**, spaces, parentheses and all. Consequences:

- Always quote identifiers in queries: `.select('"Secondary Type"')`, `.eq('Property State', v)`.
- The count `278` is asserted in the migration. If it changes, that assertion must change with it, deliberately.
- **Adding a field means changing the schema**: migration *and* catalog constant, in one change, or import and export immediately disagree.

`price_per_acre` is derived in application code from price and acreage. It is read-only on every surface, including edit forms.

### 3.2 Validation

`landSaleInputSchema` (`lib/land-sales/schema.ts`) is the single definition of a record's shape, consumed by the manual form, the CSV validator, and insert typing. Extend it there — never re-validate ad hoc at a call site.

It is **deliberately forgiving** (README §6.2). Numeric coercion strips currency symbols and separators and yields `undefined` rather than an error; unrecognized dates yield `undefined` with the original text preserved in `sale_date_raw` and surfaced as a *warning*. Essentially nothing is required; an empty record is valid. A present `state` must still be a 2-letter code.

**Do not "tighten" this schema into rejecting rows.** Rejection is the failure mode it exists to prevent.

Validation runs identically client-side (immediate feedback) and server-side (the client is not trusted). If the two can disagree, that is a bug.

### 3.3 The round trip is the contract

Import accepts the exact template header row and nothing else — no fuzzy matching, no column remapping, no auto-created fields. Export emits `COSTAR_HEADER_ROW` verbatim.

**Any change touching import, export, the catalog, or the schema must be tested in both directions**: a file exported from here re-imports here, and the record survives unchanged. This is README §6.1 and it is the system's central constraint.

### 3.4 Resolve the arrangement defensively

Stored configuration and the live catalog drift apart. Configuration naming a field that no longer exists is **dropped**; a field the configuration never mentioned keeps its **catalog position** and follows. Stored JSON is untrusted input — malformed entries are skipped, never thrown on.

Adding a catalog field must never require re-saving the arrangement and must never blank a screen.

### 3.5 Audit logging

Every mutation leaves an audit entry. Logging is **best-effort and must never block or fail the operation it describes** — `logAudit` swallows its own errors by design. Do not make it strict.

---

## 4. Migrations

Live in `supabase/migrations/`, named `<timestamp>_<snake_case_description>.sql`.

- **Additive and idempotent**: `add column if not exists`, guarded `do $$ ... $$` blocks for constraints.
- End schema-changing migrations with `notify pgrst, 'reload schema';` so PostgREST picks up the change.
- Explain *why* in a header comment. The existing migrations do this well — match them.
- New tables need RLS policies in the same migration. A table without a policy is either invisible or wide open.
- **Never write a destructive migration** (drop, truncate, non-additive type change) without explicit confirmation.

⚠️ **`supabase/migrations/` is not a complete history.** The `users`, `result_display_settings`, and `audit_log` tables exist live but have no creating migration checked in. Verify against the live schema before concluding a table or column is missing — and do not "restore" one by writing a creating migration.

Note also that migration timestamps are not in dependency order (`20260823015605` predates `20260823220450`, which creates the table the former alters). Read what is actually live rather than replaying the directory.

---

## 5. TypeScript and code conventions

These are observed from the codebase and are consistent — match them rather than importing habits from elsewhere.

**Types**
- `type` aliases only. The repository contains **zero** `interface` declarations across 69 type aliases. Keep it that way.
- **Discriminated unions with an exhaustive default**, the house pattern, used 24 times:
  ```ts
  default: {
    const _exhaustive: never = column;
    return _exhaustive;
  }
  ```
  Use it on every union switch. It turns "someone added a variant" from a runtime surprise into a compile error.
- No `any`. No non-null `!` except the documented environment-variable reads in `lib/supabase/*`.
- Derive types from values (`typeof X[number]`, `z.infer`) rather than restating them.

**Modules**
- Named exports everywhere. The only default exports are Next's required page/layout/error/loading exports — `components/` has none, by design.
- Import via the `@/` alias, not deep relative paths.
- Files `kebab-case.ts`; types `PascalCase`; functions `camelCase`; catalog constants `SCREAMING_SNAKE_CASE`.

**Formatting** — single quotes, semicolons, 2-space indent, trailing commas in multi-line literals. No formatter is configured; match surrounding code.

**Comments** — this codebase's comments are unusually good and are part of its value. They explain *why* and state invariants; they never narrate *what*. Block comments sit above exported functions that carry a rule:

```ts
/** Never blocks import: an unparseable date just comes through as undefined
 * (stored null) — `sale_date_raw` is where the CSV row builder stashes the
 * original text, so the UI can flag the record rather than losing source data. */
```

Match that standard. When you encode a non-obvious decision, say why in one sentence. Do not add comments that restate the code.

---

## 6. UI conventions

The interface is built against the **Industry** design system (`claude_design/_ds/industry-*/readme.md`, ported to `styles/design-system/industry.css` and imported once from `app/layout.tsx`). **Read that readme before styling anything.** Its rules are requirements, not suggestions (README §6.5).

- Take every color, font, spacing, and radius from its CSS variables. **Never** hard-code a hex, font name, or pixel value the tokens already carry.
- Build from its component classes (`.btn`, `.card`, `.table`, `.field`, `.tag`, `.seg`, `.dialog`) rather than parallel ones.
- Cards, figures, and primary buttons are blueprint objects: the `.blueprint` class plus four `<i class="corner …">` registration marks. Square corners; no fills on cards.
- Icons are `lucide-react` at `strokeWidth={1.5}`.
- Hover, pressed, `:focus-visible`, and disabled states are built into the system. Do not restyle them per screen.
- **Inline `style={{}}` objects referencing `var(--token)` are the established pattern.** It is fine. Do not introduce Tailwind, CSS-in-JS, or a component library — that would be a stack change, not a refactor.
- Deferred features render **visible, disabled, and titled `"Coming in a later phase"`** (README §5). Do not hide them and do not enable them.

---

## 7. Tests

`node:test` with `node:assert/strict`, colocated as `lib/**/*.test.ts`, importing subjects with explicit `.ts` extensions. Tests target pure functions in `lib/` — that is what the layering in §2.2 buys.

⚠️ **There is no configured test command**, and `package.json` has no `test` script. Plain `node --test` fails on every suite: test files use explicit `.ts` specifiers while the sources they pull in use Next-style extensionless imports, which Node's ESM resolver cannot follow. Running the suite requires registering a resolve hook that retries failed relative specifiers with `.ts`/`.tsx` and delegates via `next()`. **A first-run `ERR_MODULE_NOT_FOUND` means the harness is missing, not that your change broke something.**

`tsconfig.json` excludes `**/*.test.ts`, so type-checking does not cover test files.

Anything in §3 — catalog, mapping, validation, filter encoding, arrangement resolution, round-tripping — should ship with a test, whether or not you can execute it.

---

## 8. Verification

Two checks work out of the box. Run them before reporting work complete:

```bash
npx tsc --noEmit
```

```bash
npx next build
```

Lint:

```bash
npm run lint
```

For anything touching rendering or interaction, verify at runtime against `next dev`. Next 16 forwards browser console errors and warnings to the terminal, and writes the running server's PID/port/URL to `.next/dev/lock` — connect to an existing server rather than starting a duplicate. A dev-server MCP endpoint at `/_next/mcp` reports routes, logs, and compilation issues without a full build.

**Report honestly.** If a check did not run, say so. If it failed, show the output. Never describe work as verified on the strength of a check you skipped.

---

## 9. Git

- Branch from `main` with a typed prefix: `fix/`, `feat/`, `update/`, `chore/`. Kebab-case subject.
- Work merges via pull request.
- **Do not commit or push unless asked.**
- Commit subjects are short, lowercase, imperative, and describe effect (`fix CSV export headers`).
- Committing the Next-managed block in `AGENTS.md` alongside your work is correct — removing it only recreates the change (see the block itself).

---

## 10. Known traps

Specific, earned, and each one has cost time here before:

- **`Comp ID` is not unique.** Many imported rows share `0` or null. Row identity is the separate `id` uuid primary key. Never key, route, or deduplicate on `Comp ID`.
- **Two representations of one record.** A row carries provider-named columns; the app's `LandSale` projects a core subset out and keeps the rest in `extras`. `landSaleFromRow` / `landSaleToRow` are the only sanctioned crossing points — go through them.
- **Write repository text files as UTF-8.** `README.md` was previously UTF-16 and rendered as garbage in most tooling.
- **`lib/supabase/server.ts` has a stale comment** referring to "Middleware refreshes sessions." It means `proxy.ts`. Harmless, but do not take it as evidence that a middleware file exists.
- **Field visibility is global, not per-user** (README §2). A request phrased as "let me hide that column" is an admin configuration change, not a user preference — and if it truly means per-user, it is a scope change to raise, not build.

---

## 11. Working docs

`docs/superpowers/` holds written specs and task-by-task plans for past and in-flight work (`specs/` = intent and verification, `plans/` = checkboxed tasks, both dated `YYYY-MM-DD-slug`). Check for a relevant plan before starting substantial work, and follow it if one exists. Adding a spec and plan for non-trivial work is the established practice here.
