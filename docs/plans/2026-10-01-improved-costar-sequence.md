# Improved Sales CoStar sequence

- [x] Compare supplied headers with shared catalog and live columns; no storage changes needed.
- [x] Thread exact path sequence through display, templates, imports, and exports.
- [x] Update README and engineering contract.
- [x] Add and run path-specific contract and import/export tests (307 tests pass).
- [x] Verify live schema: both tables have 277 matching field names/types.
- [x] Validate all imported values against the live Improved composite row type: 278 values including the raw-date store, zero changed values, no inserts.
- [x] Run TypeScript and production build (pass); lint reports the existing ref error and avatar warning.
- [ ] Browser flow verification unavailable: preview open timed out twice; navigation also timed out.
