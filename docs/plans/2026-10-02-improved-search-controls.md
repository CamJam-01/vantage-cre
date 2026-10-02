# Improved Sales search controls

- [x] Inspect annotations, shared search form, and documented primary filters.
- [x] Reuse area controls; update Improved label and remove Proposed Use lookup/UI.
- [x] Add URL-backed building SF ranges, query clauses, and result-filter chips.
- [x] Update README and add focused filter tests.
- [x] Verify tests, TypeScript, lint, production build, and running preview.

Verification: 313 tests, TypeScript, and production build passed. Preview confirmed
Improved labels, Land Area unit switching, SF-only Building Area, URL reloads, combined filtering, and
sidebar range edits/removal; Land controls retained. Lint reported the existing
`react-hooks/refs` error at `components/land-sales/record-details.tsx:315` and the
existing image warning at `components/ui/profile-avatar.tsx:30`.

- [x] Remove Building Area unit toggle, acreage state/params/conversion/chips.
- [x] Recheck SF-only behavior, tests, TypeScript, build, and lint.
