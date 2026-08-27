# Field-Based Results Filters

## Goal

Replace the Land Sales results sidebar’s relic filter set (State, MSA, County, City, Type, Size, Time) with filters over the same CoStar columns the results table shows. `+ Add Filter` offers every **displayed** field. Fields hidden in Database Manager field-visibility settings are hidden from that menu as well.

Filters apply only when the user clicks **Apply Filters**. **Cancel** restores the last applied search. Closing the sidebar does not discard a draft.

The dedicated **Modify Search** page (`/search/sales/land`) is unchanged in this work. Its existing URL params must still filter results. Replacing that page is a follow-up.

## Out of Scope

- The Modify Search page UI (Location / Type / Size / Time tabs).
- CSV import, export, or templates.
- Field-visibility persistence (already shipped).
- Changing which columns exist on `land_sales`.
- Client-side filtering of already-fetched rows.

## Units

### Column type catalog

A pure helper maps each `land_sales` / CoStar column name to one of: `text`, `number`, `date`, `boolean`, using the Postgres types already declared for those columns (text, numeric, timestamp, boolean). Unknown names are treated as `text` for decoding safety and are not offered in Add Filter unless they appear in `resultColumns()`.

`resultColumns()` remains the displayed-field catalog (unique CoStar headers as `extra` columns). Visibility uses the existing `filterVisibleColumns(columns, hiddenFieldIds)` helper. Computed core fields such as Price / Acre are not in that catalog and are not filterable.

### Applied filter model

`LandSaleFilters` keeps today’s Modify Search fields (`state`, `msa`, `county`, `city`, `types`, `sfMin` / `sfMax`, `acMin` / `acMax`, `time`) unchanged so `/search/sales/land` URLs keep working.

It gains `fieldFilters`: at most one entry per CoStar column.

```ts
type FieldFilter =
  | { column: string; kind: 'text'; contains: string }
  | { column: string; kind: 'number'; min?: number; max?: number }
  | { column: string; kind: 'date'; from?: string; to?: string } // YYYY-MM-DD
  | { column: string; kind: 'boolean'; value: boolean };
```

Empty values are not stored: a text filter with a blank string, a number with neither min nor max, a date with neither from nor to, or a boolean left unset is omitted on Apply.

### URL encoding

Field filters use a repeated `ff` query param, separate from legacy params. Each `ff` value is:

`{column}|{kind}|{payload}`

- `text` payload: the contains string (the whole `ff` value is URL-encoded; `|` is not allowed in column names).
- `number` payload: `min:max` with either side optional (`100:`, `:500`, `100:500`).
- `date` payload: `from:to` as `YYYY-MM-DD`, either side optional (`2024-01-01:`, `:2024-12-31`, `2024-01-01:2024-12-31`).
- `boolean` payload: `true` or `false`.

Malformed `ff` values, unknown kinds, and columns not in `resultColumns()` are ignored on decode. Duplicate columns: last well-formed `ff` wins.

Legacy params continue to encode/decode exactly as today.

### Query application

`applyLandSaleFilters` still applies legacy params first (same column mapping as today: Property State, Market, Property County, Property City, Property Type, Land Area SF / AC, Sale Date).

It then ANDs each `fieldFilter`:

- text → `ilike(column, '%' + contains + '%')` (case-insensitive contains)
- number min → `gte(column, min)`; max → `lte(column, max)`
- date from → `gte(column, from)`; to → `lte(column, to)`
- boolean → `eq(column, value)`

A hidden field in a **legacy** param still filters the query so Modify Search does not silently no-op. Hidden fields are omitted from Add Filter only. An `ff` for a hidden column still applies if present in the URL (for example after an admin hides a field that was already applied).

### Results sidebar

`FiltersSidebar` receives the same visible `ResultColumn[]` as the table, plus the decoded `LandSaleFilters` from the page URL.

**Draft vs applied**

- **Applied** state is the current URL / `filters` prop. The results table, Filters badge count, and query use only this.
- **Draft** state is React state: which fields are added and their control values. It initializes from `filters` on first mount and whenever the URL changes from an Apply (or from external navigation). It does **not** reset when the sidebar closes or reopens.

**Relic widgets** (State, MSA, County, City, Type, Size, Time) are removed from this sidebar. Legacy values from Modify Search still affect results and the badge; they are not shown as those old controls. If a matching visible CoStar column is already in `fieldFilters` or the user adds it, they edit it as a typed field filter. This work does not auto-copy leftover legacy params into `ff` (avoids double-filtering the same column). Follow-up search-page work will stop emitting legacy params.

**+ Add Filter**

- Opens a `position: fixed` searchable menu (keep the existing viewport-aware positioning so the list is not clipped by sidebar overflow).
- Lists visible columns whose labels match the query (case-insensitive substring), excluding columns already in the draft.
- Hidden field-visibility columns never appear.
- Choosing a column adds one empty typed control and closes the menu. The draft now differs from applied, so Apply / Cancel enable.
- A field may appear in the draft only once.

Each added field shows a labelled control:

- text: one contains input
- number: min and max
- date: from and to (`type="date"`)
- boolean: a three-state control — blank (unset), Yes, or No

Each added field has a remove control that drops it from the draft (not from the URL until Apply).

**Footer buttons**

- **Apply Filters** — encodes the draft’s non-empty field filters into `ff` params, preserves leftover legacy params, `router.replace`s `/land-sales?...`, which re-runs the server query. Empty drafted fields are omitted from the URL; after navigation the draft re-syncs from applied, so those empty fields disappear.
- **Cancel** — copies applied `filters` back into the draft (added fields and values). URL and results unchanged.
- Both buttons are disabled until the draft **shape** differs from applied: which columns are present and their control values, including empty added fields. Comparing only encoded `ff` params is not enough, because adding a field and leaving it blank must still enable Cancel (and Apply, which then no-ops the URL and drops the empty field).

Typing, adding, and removing fields only mutate the draft. No debounce, no live `router.replace`.

**Badge**

The Filters FAB badge counts applied filters only: number of non-empty `fieldFilters` plus each active legacy dimension (same seven as today: state, msa, county, city, types, size, time). Draft-only changes must not change the badge or the table.

## Testing

Pure tests (existing `node:test` style):

- Type catalog: known numeric / date / boolean CoStar columns; remaining listed headers are text.
- `ff` encode/decode round-trip for each kind, including one-sided number and date ranges.
- Duplicate / malformed `ff` ignored or last-wins as specified.
- Empty field filters omitted from encode.
- `applyLandSaleFilters` ANDs `ff` with leftover `state` / `sfMin` / date-range params (assert the query builder calls, or extract a “filter clauses” helper if the Supabase client is awkward to assert).
- Add Filter candidate list: visible columns minus drafted minus hidden.
- Draft equality: Apply/Cancel enabled when drafted columns or values differ from applied, including an extra empty field.

Component behavior that is hard to unit-test without a React runner stays as manual verification: searchable menu, close/reopen keeps draft, Apply updates results, Cancel restores controls.

## Success Criteria

- `+ Add Filter` lists displayed CoStar fields and omits field-visibility-hidden fields.
- Controls match column types (contains / min-max / date range / yes-no).
- Results and URL change only on Apply Filters.
- Cancel restores the last applied search; closing the sidebar keeps the draft.
- Modify Search URLs still filter results.
- Relic State / MSA / County / City / Type / Size / Time widgets are gone from the results sidebar.
