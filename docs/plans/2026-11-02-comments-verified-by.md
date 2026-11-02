# Comments and Verified By

- [x] Confirm scope exceptions and behavior with the user.
- [x] Reuse shared result columns, arrangement, record forms, and combobox.
- [x] Rename the results action to Reports and app labels/tags to Comments.
- [x] Add app-only Verified By mapping, controls, suggestions, and merge tag.
- [x] Add/apply an additive migration and verify both live nullable text columns.
- [x] Update README and AGENTS with approved exceptions and CSV boundaries.
- [x] Unit tests: 365 passed, including both CSV paths and fragmented merge tags.
- [x] TypeScript and production build passed; `git diff --check` passed.
- [x] Live schema: 277 provider names/types agree in each table; `_verified_by` is nullable text in both.
- [x] Lint executed: 5 existing errors and 4 existing warnings. The edited record component's original HEAD source has the same two hook errors; the other findings are in untouched files.
- [x] Runtime attempt against the existing server: protected pages redirect to login. Private test-login request timed out; authenticated UI flows remain unverified.

Removed the redundant separate default-column list and retired the app's
`transaction_notes` merge tag in favor of `comments`. Existing Word templates
using the retired tag need to be updated. No dependencies added; no commit/push.
