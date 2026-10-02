# Improved Sales search controls

Apply the preview annotations to Improved Sales only: rename Land Type to
Property Type, remove Proposed Use from the form, and put Building Area
immediately below Land Area on the Size tab. Both areas have min/max inputs. Land Area retains its SF/AC toggle and
clear-on-unit-switch behavior; Building Area is always in SF, with no unit toggle.

Reuse the area-control layout and applied-filter entries. Building Area targets
the catalog's Building SF column. Remove building-acre state, URL parameters,
conversion, and filter chips; stale building-acre parameters are ignored.
Preserve both ranges and the Land Area unit in the URL and support editing/removal in results.
Keep Land Sales controls and the catalog, records, and import/export unchanged.

Verify URL round trips, malformed numeric parameters, filter counts, query
clauses, independent filter-chip changes, and both paths in the running preview.
Run tests, TypeScript, lint, and production build.
