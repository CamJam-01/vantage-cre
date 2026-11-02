# Comments and Verified By

Approved scope exceptions, 2026-11-02: both Land and Improved Sales use Comments
throughout the app, with `{{ comments }}` replacing `{{ transaction_notes }}`.
Storage and CSV retain the exact provider header `Transaction Notes`.

Verified By is one optional text annotation per comp, stored as `_verified_by`.
Active Editors/Admins can type custom text or select an active profile username.
Saved text survives profile changes. It starts visible after Comments, remains
configurable through Field Manager, and merges via `{{ verified_by }}` even when
hidden. It is excluded from all CoStar CSV templates/imports/exports. The results
action menu reads Reports sitewide.

Verification: both CSV round trips, default and saved arrangements, protected
hidden fields, clearing/custom input, username suggestions, URL filters/sorting,
and fragmented Word tags. Run unit tests, TypeScript, lint, production build,
and record runtime behavior against the existing development server.
