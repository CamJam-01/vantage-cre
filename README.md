# Bowery Valuation DBMS

> **Read this before changing anything.** This document defines *what this
> product is and what it is for*, independent of how it is built. It is the
> authority on purpose, scope, vocabulary, and the rules a change must not
> break. `AGENTS.md` / `CLAUDE.md` carry the technical conventions; where the
> two disagree about *intent*, this file wins.
>
> It is also a **living document**. Scope is expected to change; what is not
> expected is scope changing without this file changing with it. See
> §5 "Changing this scope" before building anything it does not describe.

---

## 1. What this is

An internal database of **real estate comparables** for a commercial appraisal
practice.

An appraiser valuing a property needs evidence: recent transactions of similar
properties in a similar market. Those transactions are called *comps*. This
application is where the practice keeps its comps, and where an appraiser goes
to pull the handful that support a specific valuation.

The product exists to serve one loop, repeated many times a day:

> **Ingest** a body of market transactions → **narrow** it to the comps relevant
> to the property being valued → **inspect and correct** individual records →
> **export** the chosen set so it can be carried into an appraisal report.

Everything in the codebase is in service of that loop. A feature that does not
make that loop faster, more accurate, or more trustworthy is out of scope.

**This is not a system of record.** The authoritative source for most records is
an external commercial market-data provider. This application holds a working
copy the practice can filter, correct, annotate, and organize to its own taste.
That framing drives most of the design rules in §6.

---

## 2. Who uses it

A single firm. One shared corpus of records; no customer separation, no
workspaces, no per-user data partitioning. Everyone signed in is looking at the
same database.

Users are distinguished only by **role**:

| Role | Can do |
| --- | --- |
| **Viewer** | Search, read records, export a selection. Cannot change data. |
| **Editor** | Everything a Viewer can, plus create records (one at a time or in bulk) and edit existing ones. |
| **Admin** | Everything an Editor can, plus delete records, manage users and roles, and define the field configuration (§3) that everyone else sees. |

A user may additionally be **suspended**, which revokes write ability
regardless of role.

Two consequences worth stating plainly, because they are easy to get wrong:

- **Role is an authorization boundary, not a UI preference.** Hiding a button is
  a courtesy. Every operation that changes data must independently verify the
  caller's role at the point of execution. Assume any write path can be invoked
  directly, without the UI.
- **Admin configuration is global.** When an Admin changes how fields are
  arranged, it changes for every user. There is no personal view. If a change
  request sounds like "let each user pick…", it is a scope change, not a bug.

---

## 3. Vocabulary

These terms have precise meanings here. Use them; do not invent synonyms.

**Record / comp**
: One observed transaction. The unit of everything — search returns records,
  export emits records, a detail screen shows one record.

**Database (category)**
: A family of comps that share a shape. The intended set is **Sales**,
  **Rentals**, **Expenses**, and **Costs**. Only *Sales* exists as real data.

**Property-type path**
: Within Sales, a further split by what was transacted: **Land**, **Improved**,
  **Ground Leases**. Only *Land* is built. `Sales → Land` is therefore the one
  path that works end to end, and is the reference implementation for every
  path added later.

**Field**
: One named attribute of a record. **A field *is* a CoStar header string** —
  there is no other kind of field, and no field has a second name. The catalog
  is *large* (278 header positions, 277 distinct names) because it is inherited
  wholesale from the provider's export format rather than designed here. Most
  fields are empty on most records. That is expected and must not be
  "cleaned up." The catalog is **closed**: see §3A.

**Field configuration (the *arrangement*)**
: The Admin-owned, global answer to three questions: which fields are
  **visible**, in what **order**, and how they are **divided** into pages and
  groups on the record screen. It is stored data, not code. One arrangement per
  database.

**Divider**
: A labeled break in the arrangement that holds no data of its own. A **page**
  divider starts a new tab on the record screen; a **group** divider titles a
  section within a page.

**Merge template**
: A Word `.docx` file an Admin has uploaded and named, used to turn selected
  records into a document. Templates are global, like the arrangement — there is
  one shared set per database, not one per user.

**Merge tag**
: The placeholder a template writes to pull in a field's value, in the form
  `{{ comp_id }}`. A tag names a field the only way fields are named — by its
  catalog header — mechanically lowercased with non-alphanumeric runs collapsed
  to underscores. The tag set is *derived* from the catalog and is never
  written down separately (§6.1, §6.7).

**The provider format**
: The CoStar CSV export — a fixed, ordered header row. It is simultaneously the
  field catalog, the database columns, the import contract, and the export
  contract. See §3A and §6.1; this is the single most load-bearing fact about
  the system.

---

## 3A. The field catalog — closed and canonical

**One header set governs everything.** The CoStar header row in Appendix A is
the field catalog, the `land_sales` column set, the CSV import template, and
the CSV export format — **all four are the same list, in the same order, with
the same spelling**. There is no mapping layer, no alias, no renamed subset, no
app-specific field identifier.

**The catalog is closed.** No header may be added, removed, renamed, reordered,
aliased, or given a display synonym — not in the database, not in the template,
not in the export, not in code, not in the UI. A change to this list is a change
to the product's contract with CoStar, and is out of scope for ordinary work
(§5 "Changing this scope").

**Display never touches storage.** What appears in the results table and on the
record create/view/edit screens is the result of an Admin toggling visibility
and reordering fields in settings (§3 *arrangement*). That configuration is
presentation only. **It has no bearing whatsoever on the database columns, the
import template, or the export file.** Hiding a field does not drop a column.
Reordering fields does not reorder the CSV. Every export emits all 278 header
positions in canonical order regardless of what any user can see.

### The carve-outs

Exactly three things in the physical table are not catalog fields. All are
required, all are documented here, and **none may ever appear in the
catalog, the import template, the export file, or the UI as a field**:

| | What | Why |
| --- | --- | --- |
| `id` | `uuid`, primary key | Row identity. CoStar's `Comp ID` is not unique — many rows share `0` or null — so it cannot serve as a key. |
| `Sprinklers` | one column, two header positions | The header row lists `Sprinklers` twice (positions 259 and 260 of 278). Postgres cannot hold two columns of one name, so 278 header positions map to 277 columns. An import keeps the second position's value and export writes that value into both. If a source file ever carries different values there, one is lost. **Accepted known lossiness** — do not add a column without a §5 decision. |
| `_sale_date_raw` | `text`, system store | Holds the original text of an unrecognized `Sale Date` so ingest can flag the row for review and export can re-emit it. Named to be self-evidently outside the catalog. |

Any future non-catalog storage column joins this table or it does not exist.

### Verified state

As of this writing the four representations agree exactly: the canonical list in
Appendix A, the `COSTAR_HEADER_ROW` constant in `lib/land-sales/costar-fields.ts`,
the header list in the creating migration, and the live `land_sales` columns
(277 catalog columns in canonical order, plus `id` and `_sale_date_raw`). **Appendix A is the
contract; the code constant is its executable copy.** A test must assert they
remain byte-identical — that test is what makes the single-source claim real
rather than aspirational.

---

## 4. The spine

Seven capabilities. A change either extends one of these or is out of scope.

1. **Sign in.** Email/password with confirmation and password reset. Every
   screen except the auth screens requires a session; an unauthenticated
   request is redirected to sign-in rather than shown an empty state.

2. **Choose what to search.** A deliberate narrowing: pick a database category,
   then a property-type path, then build filters. The picker steps exist to make
   the *shape of the full product* legible even while most branches are unbuilt.

3. **Filter.** Two tiers, both of which must agree with each other, and both
   addressing catalog headers by their exact names:
   - **Primary filters** over the headers an appraiser reaches for first —
     `Property State`, `Property County`, `Property City`, `Market`,
     `Secondary Type`, `Land Area AC` / `Land Area SF` range, and a `Sale Date`
     window (an absolute range or a trailing period).
   - **Field filters** over any visible field, typed by that column's Postgres
     type: text *contains*, numeric *min/max*, date *from/to*, boolean *is*.

   A filter set is fully expressible in the page address, so a search is a
   shareable, bookmarkable, reloadable thing. Do not introduce filter state that
   cannot survive a page reload.

4. **Read the results.** A table of matching records, one column per visible
   field in the Admin's order, sortable by any column, with rows selectable
   individually or all at once. Records whose imported data was flagged during
   ingest are marked here for review.

5. **Inspect and correct one record.** A detail screen laid out entirely by the
   arrangement — the visible catalog fields, in the Admin's order, distributed
   across the Admin's pages and groups. An Editor edits in place. Every editable
   field submits together, so a field must appear exactly once across the whole
   layout. The layout is presentation; the record's columns are unaffected by it
   (§3A).

6. **Get the comps out.** Export the *selected* rows in the provider format:
   **all 278 header positions, in canonical order, every time** — never only the
   visible fields, never in the Admin's display order. Selection survives paging
   through a result set; the header checkbox adds or removes the current page
   only. Export is a Viewer-level capability: reading and taking away what you
   read are the same permission.

   The same selection can instead be **merged into a Word document**: the
   Admin's chosen template is filled once per selected record and returned as a
   single `.docx`, one record per section. Merge is the same Viewer-level
   permission as CSV export and reads the full record, not just the visible
   fields — but it is a *deliverable*, not the provider format, and does not
   round-trip (§6.7).

7. **Get records in.** Two paths, both Editor-level:
   - **Bulk import** of a provider-format CSV, whose header row must match the
     template exactly (§6.1).
   - **Manual entry** of a single record through a form driven by the same
     arrangement as the detail screen. Fields the Admin has hidden are simply
     not offered; their columns still exist and stay untouched.

Alongside the spine, **administration**: field configuration, user and role
management, and an **audit log** of who changed what and when. Every mutation is
expected to leave an audit entry; audit logging is best-effort and must never
prevent the operation it describes from succeeding.

---

## 5. Scope

### Built and load-bearing

Authentication and roles · `Sales → Land` end to end · primary and per-field
filtering · results table with sort, selection, and CSV export · record detail
with in-place editing · CSV import with per-row validation · manual record
entry · global field visibility, ordering, and dividers · **document (DOCX)
merge from admin-managed Word templates** · user administration · audit log ·
user profiles with avatars.

### Deliberately deferred

Rentals, Expenses, and Costs databases · Improved and Ground Lease paths ·
live schema editing (adding, retyping, or removing fields from the database
itself, as opposed to configuring their display).

**Deferred features are shown, disabled, and labeled "Coming in a later
phase" — not hidden.** This is intentional and is a product decision, not an
oversight. The navigation is a map of the finished product; users should be able
to see where the roads will go. Do not remove a disabled affordance to "clean
up" the UI, and do not silently enable one.

### Out of scope entirely

Multi-tenancy or workspaces · per-user view preferences · valuation math,
adjustment grids, or report generation · acting as the authoritative source for
provider data · public or unauthenticated access of any kind.

### Changing this scope

This section is a **boundary, not a filter**. Scope here is a product decision
that gets revisited, and the lists above are expected to move over time. What
must not happen is scope moving *silently* — in either direction.

**If a request asks for a feature or capability that is not listed under
"Built", or that touches "Deferred" or "Out of scope entirely," stop and ask
before building it.** This includes requests that only *seem* out of scope, and
requests that arrive as small, reasonable-sounding additions — those are the
ones that expand the product without anyone deciding to. Do not quietly build
it, and do not quietly refuse it.

Ask before starting the work, not after. Make the question specific and easy to
answer:

- name the boundary the request crosses, and quote the line it crosses;
- state the closest in-scope reading, if there is one, and what it would cost;
- ask plainly whether scope is being expanded.

**If the answer is yes, this document is now wrong, and fixing it is part of
the work — not a follow-up.** In the same change that implements the feature:

1. Move the item into **§5 "Built and load-bearing"**, or add it there.
2. Add any new term to **§3 Vocabulary** — new concepts need shared names
   before anyone builds on them.
3. Add or amend a **§4 spine** capability if the request adds a step to the
   loop, rather than extending an existing one.
4. Revisit **§6 Governing principles**. A genuinely new capability often
   introduces a new invariant, or puts pressure on an existing one. Say so
   here; that is what §6 is for.
5. Update **§8 How to extend** if the request establishes a new kind of change.
6. Carry any technical constraints into `AGENTS.md`.

The reason this is not optional: the next agent will read this file, not the
conversation that authorized the change. An expansion recorded only in chat
history will read as scope creep to whoever comes next, and will be
"cleaned up" by someone acting in good faith on a stale document.

If the answer is no, the boundary stands. Say what you did not build and why,
and leave this document alone.

---

## 6. Governing principles

These are the invariants. Breaking one is a defect even if every test passes.

### 6.1 The CoStar header row *is* the schema

The header row in Appendix A is the field catalog, in its exact order, including
its quirks (a duplicated name, inconsistent conventions, hundreds of columns
irrelevant to land). The stored record mirrors those names verbatim, quirks
included. Import accepts that header row and no other — a renamed, reordered,
added, or missing column is a rejected file, never a guessed mapping. Export
reproduces that header row exactly, in full, every time.

The point is **lossless round-tripping**: a file exported from here must be
re-importable here, and a record must survive the trip unchanged. When adding a
capability, ask what it does to the round trip before asking anything else.

**There is no second field model.** No subset of the catalog gets its own names,
types, labels, layout, or identifiers; no header is aliased, abbreviated, or
retitled for display; no value is computed and then presented as though it were
a field. If a question has an answer in the catalog, that column *is* the
answer. Earlier versions of this project carried a hand-picked "core field"
layer of renamed headers — it is a deprecated prototype relic, not a design, and
any surviving trace of it is a defect to remove rather than a pattern to follow.

Changing the catalog is therefore not ordinary work: it changes the product's
contract with CoStar and with every previously exported file. It requires an
explicit decision under §5, and then a migration, a constant update, and an
Appendix A update together.

### 6.2 Never lose the user's data

Ingest is forgiving in a specific, deliberate way:

- A value that cannot be understood does **not** reject its record. The record
  imports with that field blank.
- When a value is dropped, the **original text is preserved** and the record is
  **flagged for human review** in the results table. Silent loss is the failure
  mode this is designed to prevent.
- Likely duplicates are **reported to the user**, never silently skipped or
  silently merged. The user decides.
- Essentially no field is mandatory. An empty record is valid. Ingest exists to
  capture what the provider actually sent, not to enforce an ideal.

Validation runs identically on the client (for immediate feedback) and on the
server (because the client is not trusted). When those two disagree, the server
is right and the divergence is a bug.

### 6.3 Configuration is data

Which fields exist, which are shown, in what order, under what headings — all of
this is stored configuration resolved at read time. It is never expressed as
per-field components, hard-coded lists, or bespoke screens.

The arrangement is resolved **defensively**, because stored configuration and
the live catalog drift apart: a configuration entry naming a field that no
longer exists is dropped, and a field the configuration never mentioned falls
back to its catalog position. Adding a field to the catalog must never require
re-saving the arrangement, and must never blank a screen.

Corollary: "add a new field to the record screen" is an *administrative*
action, not a code change. If a request can be satisfied by configuration,
satisfy it by configuration.

### 6.4 Authorization lives on the server

Stated in §2 and repeated because it is the most consequential rule in the
codebase: every write verifies the caller's role and suspension status at the
point of execution. Client-side gating is presentation only.

### 6.5 Visual fidelity is a requirement

The interface is built against a checked-in design system ("Industry" — a
blueprint/wireframe aesthetic: square corners, hairline borders, corner
registration marks, a single steel accent), which lives in `styles/main.css`
and is imported once from `app/layout.tsx`. Its rules are non-negotiable in the
same way the data rules are: take every color, font, spacing, and radius from
its tokens, and build from its component classes rather than parallel ones. A
visually inconsistent screen is an unfinished screen.

`styles/main.css` is now the whole system — the token sheet and the component
layer, and the only stylesheet. The system's original prose guide is no longer
checked in, so its governing rules are recorded in `AGENTS.md` §6; read that
before styling, and keep it in step with the sheet.

### 6.6 Prefer the boring shape

This is a small, single-tenant internal tool with a handful of users. Favor the
direct implementation over the general one. Do not introduce abstraction layers,
plugin systems, or configuration surfaces in anticipation of the deferred
features in §5 — build them when the feature is actually built, informed by
`Sales → Land` as the worked example.

### 6.7 A merged document is a deliverable, not an interchange format

§6.1 makes the CSV round trip the system's central constraint: what this
exports, this re-imports, unchanged. **DOCX merge is deliberately outside that
rule**, and the distinction matters because both are reached from the same
Export menu.

A merged document is written for a person to read. Values are display-formatted
exactly as the results table renders them, an empty field merges as nothing at
all rather than a placeholder, and the whole thing is shaped by whatever the
template author wrote. It is lossy by construction and **nothing ever imports
it**. Do not add a DOCX import path, do not extend the round-trip test to cover
it, and do not "fix" the merge to preserve raw values — the CSV export is where
fidelity lives, and it is untouched by any of this.

Two rules do carry over from §6.1. The tag set is **derived from
`COSTAR_HEADER_ROW`**, so a header added to the catalog gets a merge tag with no
further work and no second list to update. And a template is **user content, not
code** — an unrecognized tag is left visibly in place rather than silently
blanked, so the author can see their own typo.

---

## 7. Map of the codebase

Enough to orient; the details belong in `AGENTS.md`.

| Concern | Where |
| --- | --- |
| Screens and routes, one directory per step of the spine | `app/` |
| Authenticated area (search, results, record detail, import, admin, profile) | `app/(app)/` |
| Sign-in, sign-up, callbacks, password reset | `app/login/`, `app/signup/`, `app/auth/` |
| Domain logic — the part worth reading first | `lib/land-sales/` |
| The provider catalog, field types, and record ⟷ row mapping | `lib/land-sales/` (catalog and mapping modules) |
| Filter encoding/decoding and query construction | `lib/land-sales/` (search-params, query, field-filters) |
| The arrangement: visibility, ordering, dividers, page layout | `lib/land-sales/` (field-visibility, display-settings) |
| Import/export, validation, duplicate detection | `lib/land-sales/` (csv, schema, dates) |
| DOCX merge: tag derivation, WordprocessingML surgery, template metadata | `lib/land-sales/` (merge-tags, docx-xml, docx-merge, docx-templates) |
| Roles, permissions, user profiles | `lib/users/` |
| Admin descriptors and configuration handling | `lib/admin/` |
| Audit logging | `lib/audit/` |
| Feature components, grouped by area | `components/` |
| Shared primitives built on the design system | `components/ui/` |
| Database schema history | `supabase/migrations/` |
| The design system — tokens and component classes, the only stylesheet | `styles/main.css` |
| Written specs and plans for past and in-flight work | `docs/specs/`, `docs/plans/` |

Unit tests sit beside the modules they cover in `lib/`, as `*.test.ts`.

### Repository caveats

Two things that will otherwise cost an agent time:

- **`supabase/migrations/` is not a complete history.** Several live tables —
  user profiles, the display-configuration table, the audit log — were created
  outside the migration files present here. Do not infer that a table is absent
  because no migration creates it, and do not "restore" one by writing a
  creating migration without checking the live schema first.
- **There is no configured test command.** Test files exist and are meaningful,
  but running them requires resolver setup that the repository does not ship.
  Type-checking and the production build are the checks that work as-is.

---

## 8. How to extend

Match the request to its shape before writing anything.

| The request | What it actually is |
| --- | --- |
| "Show field X on the record screen" / "reorder fields" / "group these together" | **Configuration.** Do it through the admin arrangement. No code. |
| "Add field X to the database" / "rename this column" / "drop the fields we don't use" | **A change to a closed catalog (§3A).** Not ordinary work. Confirm under §5 first; if approved, migration + `COSTAR_HEADER_ROW` + Appendix A move together. |
| "Field X should show as *Y* on screen" | **No.** A field's name is its header (§3A). Rename the *header* via the process above, or leave it. |
| "Make field X filterable" | Confirm the column's Postgres type is classified correctly; the filter tier follows from that type. Nothing else is required — every catalog field is equally a field. |
| "Only export the columns we're actually using" | **No.** Export is always all 278 positions in canonical order (§4.6, §3A). |
| "Add a merge tag for field X" | **Nothing to do.** Every catalog field already has one, derived from its header (§3 *Merge tag*). If a tag seems missing, the header is not what you think it is. |
| "Make the merged document keep raw values" / "import a DOCX" | **No.** A merged document is a deliverable, not an interchange format (§6.7). Fidelity lives in the CSV export. |
| "Add a Rentals/Improved/… database" | **A new spine branch.** Substantial. Follow `Sales → Land` structurally; expect a new catalog, a new table, and a new arrangement, not a parameterized generalization of the existing one. |
| "Change what import accepts" | Almost always wrong — re-read §6.1 and confirm the round trip survives before proceeding. |
| "Let users customize their own view" | **Out of scope** as stated (§2, §5). Raise it rather than building it. |
| "Change a color/spacing/border" | Through design-system tokens only (§6.5). |
| Anything not on this table and not in §5's "Built" list | **A possible scope change.** Ask before building, and if it is confirmed, amend this document as part of the work — see §5 "Changing this scope". |

When a request is genuinely ambiguous, the tie-breaker is §1: which reading
makes an appraiser's ingest → narrow → inspect → export loop faster or more
trustworthy? If no reading does, that is a strong signal the request is a scope
change rather than an extension — ask.

---

## 9. Running it

A Next.js application backed by Supabase (Postgres, authentication, storage) and
deployed to Vercel.

```bash
npm run dev
```

Copy `.env.example` to `.env.local` and fill in the Supabase project URL and
anonymous key from the project's API settings. Authentication redirects use the
deployed origin, so the Supabase project's redirect allowlist must include the
callback path for whichever origin you are running against.

See `AGENTS.md` for framework conventions, code style, and verification steps —
and read it before writing code, as the framework in use here diverges from what
you may expect.

---

## Appendix A. The canonical CoStar header row

**This is the contract.** 278 header positions, 277 distinct names
(`Sprinklers` appears at positions 259 and 260). It defines, identically and
simultaneously:

- the `public.land_sales` columns (these 277 names, plus the `id` and
  `_sale_date_raw` carve-outs);
- the CSV **import** template header row;
- the CSV **export** header row;
- every field the application knows about.

Nothing may be added, removed, renamed, reordered, or aliased. See §3A for the
carve-outs and §6.1 for the governing rule. The executable copy is
`COSTAR_HEADER_ROW` in `lib/land-sales/costar-fields.ts`, which must stay
byte-identical to the line below; a test enforces this.

```text
Property Address,Property City,Property State,Property Type,Land Area AC,Land Area SF,Star Rating,Sale Price,Sale Date,Sale Status,Asking Price,Price Per AC Land,Price Per SF Land,Sale Type,Property Name,Buyer (True) Company,Buyer (True) Type,Buyer (True) Secondary Type,Buyer (True) Origin,Acquisition Fund Name,Buyers Broker Company,Seller (True) Company,Seller (True) Type,Seller (True) Secondary Type,Seller (True) Origin,Listing Broker Company,Hold Period,Secondary Type,Proposed Use,Zoning,Market,Disposition Fund Name,Submarket Name,Location Type,Property County,Country,Subcontinent,Continent,Property Zip Code,Corner,Map Code,Actual Cap Rate,Affordable Type,Age,All-Inclusive,All-Suites,Amenities,Anchor Tenants,Assessed Improved,Assessed Land,Assessed Value,Assessed Year,Average Rental Rate Per kW,Avg Unit SF,Brand,Building Class,Building Condition,Building Materials,Building Operating Expenses,Building Park,Building SF,Building Tax Expenses,Buyer (Contact) Address,Buyer (Contact) City,Buyer (Contact) Company,Buyer (Contact) Contact Name,Buyer (Contact) Phone,Buyer (Contact) State,Buyer (Contact) Zip Code,Buyer (Recorded) Address,Buyer (Recorded) City,Buyer (Recorded) Company,Buyer (Recorded) Contact Name,Buyer (Recorded) Phone,Buyer (Recorded) State,Buyer (Recorded) Street Name,Buyer (Recorded) Street Number,Buyer (Recorded) Street Post-Direction,Buyer (Recorded) Street Pre-Direction,Buyer (Recorded) Zip Code,Buyer (True) Address,Buyer (True) City,Buyer (True) Contact Name,Buyer (True) Phone,Buyer (True) Post-Direction,Buyer (True) Pre-Direction,Buyer (True) State,Buyer (True) Street Name,Buyer (True) Street Number,Buyer (True) Zip Code,Buyers Broker Address,Buyers Broker Agent First Name,Buyers Broker Agent Last Name,Buyers Broker City,Buyers Broker Phone,Buyers Broker State,Buyers Broker Street Name,Buyers Broker Street Number,Buyers Broker Street Post-Direction,Buyers Broker Street Pre-Direction,Buyers Broker Zip Code,Capacity - Available kW,Capacity - Critical IT kW,Capacity - Total Utility kW,Ceiling Height,Column Spacing,Comp ID,Comps Number,Construction Begin,Construction Material,Cooling Redundancy,Coverage,Cross Street,Data Center Tier,Data Center Type,Data Hall Area SF,Data Hall Count,Density kW/rack,Density kW/SF,Description Text,Document Number,Down Payment,Drive Ins,Electric Utility,Fips Code,Fire Sprinkler,First Trust Deed Balance,First Trust Deed Lender,First Trust Deed Payment,First Trust Deed Terms,Flood Risk,Flood Zone,Floor Area Ratio,Frontage,GIM,GRM,Gross Income,Has Lab Space,Heating,Hotel Class,Hotel Location Type,Hotel Operator,Improvement Ratio,Lab Space (SF),Lab Space Percent Composition,Land Improvements,Land SF Gross,Land SF Net,Latitude,Legal Description,Listing Broker Address,Listing Broker Agent First Name,Listing Broker Agent Last Name,Listing Broker City,Listing Broker Phone,Listing Broker State,Listing Broker Street Name,Listing Broker Street Number,Listing Broker Street Post-Direction,Listing Broker Street Pre-Direction,Listing Broker Zip Code,Loading Docks,Longitude,Lot Dimensions,Map Page,Map X,Map Y,Market Time,Multi-Sale Name,Net Income,Non-Arms Length Reasons,Number of 1 Bedroom Units,Number of 2 Bedroom Units,Number of 3 Bedroom Units,Number of Beds,Number of Cranes,Number of Floors,Number of Other Bedroom Units,Number of Parking Spaces,Number of Rooms,Number of Studio Units,Number of Tenants,Number of Units,Office Space,One Bedroom Mix,Other Mix,Parcel Number 1 (Min),Parcel Number 2 (Max),Parent Company,Parking Ratio,Percent Leased,Percent Office,Portfolio City,Portfolio County,Portfolio Name,Portfolio State,Portfolio Zip,Power,Power Redundancy,Power Usage Effectiveness,Pre-Leasing,Price Per AC Land Net,Price Per Room,Price Per SF,Price Per SF (Net),Price Per SF Land Net,Price Per Total kW,Price Per Unit,Pro Forma Cap Rate,Property Street Name,Property Street Number,Property Street Post-Direction,Property Street Pre-Direction,PropertyID,Publication Date,Rail Served,Recording Date,Region,Research Status,Roof Type,Sale Category,Sale Condition,Sale Price Comment,Scale,Second Trust Deed Balance,Second Trust Deed Lender,Second Trust Deed Payment,Second Trust Deed Terms,Seller (Contact) Address,Seller (Contact) City,Seller (Contact) Company,Seller (Contact) Contact Name,Seller (Contact) Phone,Seller (Contact) State,Seller (Contact) Zip Code,Seller (Recorded) Address,Seller (Recorded) City,Seller (Recorded) Company,Seller (Recorded) Contact Name,Seller (Recorded) Phone,Seller (Recorded) State,Seller (Recorded) Street Name,Seller (Recorded) Street Number,Seller (Recorded) Street Post-Direction,Seller (Recorded) Street Pre-Direction,Seller (Recorded) Zip Code,Seller (True) Address,Seller (True) City,Seller (True) Contact Name,Seller (True) Phone,Seller (True) Post-Direction,Seller (True) Pre-Direction,Seller (True) State,Seller (True) Street Name,Seller (True) Street Number,Seller (True) Zip Code,Sewer,Size,Sprinklers,Sprinklers,Stamp,Studio Mix,Submarket Cluster,Submarket Code,Tenancy,Three Bedroom Mix,Title Company,Total Expense Amount,Transaction Notes,Transfer Tax,Two Bedroom Mix,Typical Floor (SF),Units Per Acre,University,Vacancy,Water,Year Built,Year Renovated
```

### Typed columns

Every column is `text` except these, which are typed in Postgres and must be
coerced accordingly on read and write:

- **numeric** (22) — Actual Cap Rate, Asking Price, Assessed Improved, Assessed
  Land, Assessed Value, Down Payment, First Trust Deed Balance, Improvement
  Ratio, Land Area AC, Land Area SF, Land SF Gross, Land SF Net, Latitude,
  Longitude, Percent Leased, Price Per AC Land, Price Per AC Land Net, Price Per
  SF Land, Price Per SF Land Net, Sale Price, Second Trust Deed Balance,
  Transfer Tax
- **bigint** (6) — Assessed Year, Comp ID, Market Time, Number of Floors, Number
  of Tenants, PropertyID
- **timestamp** (3) — Publication Date, Recording Date, Sale Date
- **boolean** (1) — Has Lab Space

This is the same classification `lib/land-sales/costar-column-types.ts` holds;
the two must not diverge.
