# Improved Sales CoStar sequence

Approved: use the supplied Improved Sales CSV sequence without rebuilding the database.
Both paths contain the same 277 distinct names and live column types. Land remains
278 positions; Improved is 279, repeating Average Rental Rate Per kW and Sprinklers.

Use the selected path for results and record default ordering, configuration,
CSV templates, client/server import validation and value mapping, and export.
Preserve saved Admin arrangements. Duplicate positions share storage; the last
value wins and conflicting values warn. Preserve existing permissions, forgiving
coercion, date warnings, and hidden-field export behavior.

Verify the supplied file, every-field import/export round trips, differing
repeated values, CSV quoting/BOM, wrong-path headers, live schema, local browser
prevalidation, TypeScript, tests, build, and lint. Do not insert persistent test records.
