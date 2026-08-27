@AGENTS.md

# Working in this repository

The import above carries the engineering guide. This file covers how to *operate* here — what to read, what to verify, and what to ask about rather than decide.

## Read in this order

1. **[`README.md`](README.md)** — what the product is and is for. It is the source of truth for intent and scope, and its §8 table maps most requests to the kind of change they actually are. Start here even for small tasks; the most expensive mistakes in this codebase are scope misreadings, not syntax errors.
2. **`AGENTS.md`** — architecture, data rules, conventions.
3. **`node_modules/next/dist/docs/`** — before writing framework code. Next 16 renamed middleware to Proxy, made `params`/`searchParams` async, and ships Cache Components off by default. Your training data is likely wrong about all three. Read the guide, don't recall it.
4. **`claude_design/_ds/industry-*/readme.md`** — before writing anything visual.
5. **`docs/superpowers/`** — check for an existing spec or plan covering the work.

## Orient before editing

- **`lib/` first.** The domain rules live there as pure functions, and reading the relevant module usually answers the question faster than tracing a component. `costar-fields.ts`, `schema.ts`, `field-visibility.ts`, and `csv.ts` carry most of the system's actual logic.
- **Verify live schema, don't infer it.** `supabase/migrations/` is an incomplete history (AGENTS.md §4). If a Supabase MCP server is connected, list tables and check the real schema before concluding a column is missing.
- **Beware stale copies of the tree.** `.claude/worktrees/` and `.worktrees/` hold full checkouts of other branches, including files that do not exist on `main` (e.g. a `land-sales/[id]/edit/` route). A repo-wide search will match them. Confirm you are editing the primary working directory before writing.

## Verify, then report

`npx tsc --noEmit` and `npx next build` are the checks that work as-is; `npm run lint` for style. Anything touching rendering or interaction gets a runtime check against `next dev` — connect to the running server rather than starting a second one.

The test suite cannot run without a resolver shim (AGENTS.md §7). A first-run `ERR_MODULE_NOT_FOUND` is the missing harness, not your change. Still write tests for anything in AGENTS.md §3.

State plainly what you ran and what it said. If a check was skipped, say it was skipped. Never call work verified on the strength of a check you did not execute.

## Ask, don't assume

Most decisions here are yours to make. These are not — stop and ask:

- **Anything that changes scope** — a request for a feature the README does not already describe as built, or one that implies per-user preferences, a new database category, or enabling something listed as deferred. Ask before building; do not quietly build it and do not quietly refuse it. Disabled "Coming in a later phase" affordances stay visible and stay disabled until someone decides otherwise. **If the expansion is confirmed, updating `README.md` to match is part of that work, in the same change** — the procedure is in README §5 "Changing this scope". A scope change recorded only in this conversation is invisible to whoever works here next.
- **Loosening or bypassing the import/export contract.** If a change would make an exported file fail to re-import, raise it before building.
- **Destructive migrations** — drops, truncations, non-additive type changes.
- **Anything that would introduce a service-role key** or otherwise route around Row Level Security.
- **Removing a role check** from a Server Action, for any reason.

## Etiquette

Do not commit or push unless asked. Branch from `main` with a `fix/`, `feat/`, `update/`, or `chore/` prefix when you do.

Match the surrounding code — its conventions are consistent and deliberate, down to the exhaustive `never` checks and the comment style. When you encode a non-obvious decision, leave one sentence saying why, the way the existing comments do.
