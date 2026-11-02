# Per-table search filter visibility

Approved scope expansion: active Admins may hide/display search filters for Land
and Improved Sales independently. These preferences apply to both the search
sheet and results sidebar. Only columns displayed in the results table are
eligible. Filter visibility never alters records, columns, record forms, CSVs,
or merge tags. All displayed columns are filterable by default; hiding every
filter is allowed. A temporarily hidden column retains its saved filter
preference for when it is displayed again.

Unavailable filters in bookmarked or hand-edited URLs are ignored, including
legacy primary parameters. Loading the URL must not fail or redirect merely to
remove hidden criteria. Results, totals, active-filter counts, selection keys,
and record navigation all use effective filters. Subsequent navigation emits
only effective criteria.

Implementation reuses the existing Admin field-configuration page, display
settings row, field toggles, and record-layout resolver. Store only the hidden
filter keys, scoped by database key, with existing Admin RLS, Server Action
authorization, audit logging, and revalidation.

Verify per-table isolation, display eligibility, independent settings writes,
legacy and field URL criteria, no-criteria behavior, malformed configuration,
empty groups/pages, record navigation, and unchanged column/record configuration.
