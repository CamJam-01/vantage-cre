# Bowery Valuation Text Rebrand

## Goal

Replace every textual occurrence of the former product name, including its all-caps presentation, with `Bowery Valuation` or `BOWERY VALUATION` as appropriate to the existing presentation.

## Scope

The replacement covers:

- authentication screens and shared authentication UI;
- application navigation and other runtime UI;
- page metadata, including the browser title;
- checked-in design mockups; and
- descriptive source comments that use the former product name.

The change does not rename package identifiers, repository paths, folders, database objects, migration filenames, or other internal identifiers that do not present the product name as text.

## Implementation

Use direct, minimal replacements at each existing occurrence. Preserve the surrounding component structure, typography, casing conventions, styles, and behavior. Do not introduce a shared branding abstraction for this one-name replacement.

Existing unrelated working-tree changes must be preserved and excluded from any rebrand-specific commit.

## Verification

Before editing, run a repository-wide text check that fails while either casing of the former name remains in the intended text scope. After editing:

1. Re-run the repository-wide check and confirm no old-name occurrences remain.
2. Run the relevant static checks for the Next.js project.
3. Open the live login page and confirm `Bowery Valuation` renders without a framework error overlay or console error.
4. Confirm the page title and application header use the new name.
