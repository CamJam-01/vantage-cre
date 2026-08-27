# Global Field Visibility

## Goal

Allow Admin users to choose which fields are shown for each managed database table. The saved configuration is global: every website user sees the same field set on results, record-details, and manual new-record pages.

Visibility is presentation configuration only. Hiding a field must not remove or rewrite stored values, change the Supabase source-table schema, or change CSV import and export columns.

## Current Scope

The first supported database is `sales`, backed by `public.land_sales`. The design uses a database key so the same mechanism can support Rentals, Expenses, and Costs after those database categories become available.

The configuration affects:

- the Land Sales results table;
- the read-only Land Sale record-details view;
- the Land Sale record edit mode; and
- the manual new Land Sale form.

The configuration does not affect:

- search-filter availability or query behavior;
- CSV import parsing, validation, templates, or inserted values;
- CSV export columns or values;
- record-detail URLs, authorization, or audit history;
- the `land_sales` or `land_sales_custom_fields` schema; or
- fields shown inside Supabase management tools.

## Persistence Model

Add `public.result_display_settings` as a separate configuration table with one row per database key:

- `database_key text primary key`;
- `hidden_field_keys text[] not null default '{}'`;
- `updated_at timestamptz not null default now()`; and
- `updated_by uuid references auth.users(id)`.

Only hidden identifiers are stored. If no settings row exists, or a field has no matching hidden identifier, the field is visible. This preserves today's all-fields-visible behavior and makes newly introduced fields visible by default.

Field identifiers are namespaced and stable:

- core fields use `core:<field_key>`, such as `core:address`;
- imported/custom fields use `extra:<exact label>`.

Namespacing prevents a custom label from colliding with a core field. The result-column module will own identifier creation and visibility filtering so every consumer uses the same rules.

## Access Control

Enable Row Level Security on `result_display_settings`.

- Active authenticated users may select settings so normal pages can apply the global configuration.
- Only active users whose current role is `Admin` may insert, update, or delete settings.
- Anonymous and suspended users receive no access.

The admin save operation will run through a server action that independently verifies the current profile is an active Admin. RLS remains the database-level enforcement boundary if the action is called directly or another client attempts a write.

The server action accepts a known database key and hidden field identifiers. It rejects unavailable databases, unknown core identifiers, custom identifiers that are not present in the selected table's field catalog, duplicate identifiers, and a configuration that would hide every available field. A successful save upserts the table's single settings row, records the acting user and timestamp, writes an audit-log entry, and revalidates affected pages.

## Database Manager UI

Replace the current read-only Fields blueprint on `/admin/database-manager/schema?db=sales` with a `Results & Record Display` control.

The page lists all core result fields followed by catalogued custom fields. Each row shows the field label, field type/category, and a labelled visibility control. Controls edit local form state; changes are applied only when the Admin selects `Save Changes`. A `Show All` control restores every field to visible in the pending form state.

Supporting copy will state that the setting is global and changes results, record-details, and new-record screens without changing stored data, imports, or exports. The page will show a clear pending, success, or error state. Saving is disabled while unchanged or while a request is pending.

At least one available field must remain visible. The client prevents an all-hidden save for immediate feedback, while the server action enforces the same rule.

If settings cannot be loaded, the page must not silently present an editable all-visible state that could overwrite the existing configuration. It will show an error and disable saving. If the custom-field catalog cannot be loaded, saving is also disabled because the server and UI cannot reliably validate the complete field set.

## Shared Visibility Resolution

Create a focused server-side loader that reads the settings row for a database key and returns a set of hidden identifiers. A missing row means an empty hidden set. A database error is not treated as a missing row; affected pages fail visibly rather than leaking fields that may have been intentionally hidden.

Create shared pure helpers to:

- generate the stable identifier for a `ResultColumn`;
- test whether a result column is visible;
- filter a result-column list;
- test core detail fields by their `core:` identifier; and
- partition custom fields using their `extra:` identifier.

These helpers keep the results table, details page, forms, and admin settings UI aligned without duplicating string conventions.

## Results Page Behavior

The Land Sales page continues to fetch records and build the complete core-plus-custom result-column list. It also loads the global `sales` settings and filters the column list immediately before passing columns to the results table.

Sorting and table cells operate only on visible columns. Row selection and View/Edit actions remain unchanged.

CSV export remains unchanged and continues to call the existing record-based CSV serializer. It must not derive export headers or values from the filtered display-column list.

## Record Details and Edit Behavior

The record-details server page loads the same `sales` visibility configuration and passes it into the record-details component.

In both read-only and edit modes:

- hidden core fields are omitted from drafting-sheet sections;
- hidden custom fields are omitted from Additional Fields;
- sections with no visible fields are omitted;
- sheets with no visible fields are omitted; and
- header tags, title, and subtitle do not reveal hidden field values.

When visible header fields cannot produce the current descriptive heading, the page uses neutral text such as `Land Sale Record`; it does not substitute a hidden value. Sheet navigation and active-sheet state use the filtered sheet list, including validation-error navigation.

Editing visible fields must preserve every hidden stored value. The update action will load the authoritative visibility settings and existing record, validate only the editable visible-field payload, and merge it with the existing hidden core and custom values before writing. Client-supplied values for currently hidden identifiers are ignored. This prevents an ordinary edit from blanking hidden values and prevents a crafted form submission from bypassing the visibility configuration.

## New-Record Behavior

The manual new-record page loads the `sales` configuration and renders the same visible core and custom field set as record edit mode. Hidden fields are not rendered and are not accepted from a crafted manual-create submission.

Because Land Sale fields are optional, absent hidden core fields use their existing database/schema defaults, and absent hidden custom fields are not added to `extras`. The create action validates submitted visible fields against the authoritative server-side configuration before insertion.

CSV imports remain independent from manual entry and can populate every supported import field regardless of display visibility.

## Error Handling and Consistency

- Settings reads distinguish a genuinely missing row from a Supabase error.
- Admin saves return actionable errors and retain the unsaved UI state for retry.
- Page-level settings read failures are surfaced rather than falling back to all fields.
- Server actions re-read settings at submission time so a stale browser cannot create or update a field that another Admin has since hidden.
- A field removed from the available catalog may remain in `hidden_field_keys`; it is inert. A later admin save normalizes the array to identifiers that are currently valid.
- Concurrent admin saves use last-write-wins semantics for the single settings row; the audit log records each successful save.

## Testing and Verification

Automated tests will cover:

- stable core and custom field identifiers;
- default-visible behavior when no settings row exists;
- column filtering and collision prevention;
- rejection of unknown, duplicate, or all-hidden identifiers;
- RLS expectations for Viewer, Editor, Admin, suspended, and anonymous users;
- results rendering with a mix of visible and hidden core/custom fields;
- record header, sheet, section, and Additional Fields filtering;
- manual create ignoring hidden-field payloads;
- record edit preserving hidden core and custom values; and
- CSV import/export output remaining unchanged by display settings.

End-to-end browser verification will use an Admin to hide a core field and a custom field, save, and confirm the change for another user on results, record view, record edit, and manual new-record pages. It will then show the fields again and confirm they return with their stored values intact. Verification will also export a record and confirm hidden fields remain in the CSV, and exercise an import containing a hidden field to confirm that value is stored without appearing in the configured UI.

## Delivery

The migration must be applied before application code that queries `result_display_settings` is deployed. No migration will alter `land_sales`, its existing values, or import/export routines. Static checks, focused tests, a production build, migration/RLS verification, and authenticated browser flows are required before completion is claimed.
