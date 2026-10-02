# Column resizing

- [x] Confirm temporary resizing scope and amend README.
- [x] Reuse the shared results table; move width calculations into tested pure logic.
- [x] Add pointer and keyboard controls with aligned colgroup sizing.
- [x] Verify both tables at runtime and run tests, type check, build, and lint.

Verification: 309 tests passed; TypeScript and production build passed.
Focused ESLint passed. Full lint retains the pre-existing ref-during-render
error in record-details.tsx:315 and profile-avatar.tsx image warning.
The collaborative preview showed populated Land (50 rows) and Improved
(21 rows) tables. Actual keyboard controls and sorting passed. Synthetic
pointer events verified expansion, shrinking, aligned cells, and cancellation;
pointer capture was temporarily stubbed only within the browser test because
the preview has no drag command. Native pointer capture remains unchanged in
application code. Reload restored 96 px defaults on both paths. No console
errors appeared in the runtime snapshot.
