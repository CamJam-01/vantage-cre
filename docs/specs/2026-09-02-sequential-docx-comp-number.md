# Sequential DOCX comp number

## Intent

Template authors can use `{{ comp_number }}` to number merged comps sequentially
from 1 in the selected merge order. The sequence resets for every generated
document.

## Boundaries

- `{{ comp_number }}` is merge-only output structure, not a database field.
- It is generated in memory and never stored, queried, imported, exported, or
  added to the CoStar field catalog.
- All database-field merge tags remain derived from `COSTAR_HEADER_ROW`.
- Unknown tags remain visible in the generated document.

## Verification

- The Admin template catalog identifies `{{ comp_number }}` as merge-only.
- A two-record merge produces `1` and `2` in record order, including when Word
  fragments the tag across runs.
- Unit tests, type checking, lint, production build, and rendered DOCX review
  pass without a schema or migration change.
