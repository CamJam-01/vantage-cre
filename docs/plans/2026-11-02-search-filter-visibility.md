# Per-table search filter visibility

- [x] Confirm scope and URL behavior with the user.
- [x] Add pure availability, selection-validation, and effective-filter helpers.
- [x] Apply availability to both search sheets, results sidebar, results queries,
  and record-navigation queries/actions.
- [x] Add separate per-table Admin Search Filters controls with authorized,
  audited settings-only saves.
- [x] Apply additive settings migration; verify existing settings hashes unchanged.
- [x] Update README and AGENTS with the approved scope and invariants.
- [x] Unit tests: 386 passed, including eligibility, per-table isolation, malformed
  configuration, all legacy parameters, unavailable URL filters, empty sections,
  preserving column/record configuration, and safe selection validation.
- [x] TypeScript, production build, and `git diff --check` passed.
- [x] Lint executed: 5 existing errors and 4 existing warnings, all in untouched
  components. Full output: `output/search-filter-visibility-lint.txt`.
- [x] Runtime attempt against the existing server: protected results redirect to
  login. No authenticated test session is available, so signed-in settings and
  search interactions remain unverified. The verification browser was closed.

Live migration `20261102154554_add_search_filter_visibility` added only the
settings column. Both existing settings hashes matched before/after, excluding
that new column. Default hidden-filter arrays are empty for both tables.

Removed the redundant fallback settings query: reading the small settings row
once supports absent optional columns through the same defaults. No dependencies
added; no records or field/column settings removed; no commit/push.
