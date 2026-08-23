# Global Field Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one Admin-managed global field-visibility configuration per database table and apply it consistently to results, record view/edit, and manual new-record pages without changing stored hidden values or CSV behavior.

**Architecture:** A new RLS-protected `result_display_settings` table stores namespaced hidden field identifiers for each database key. Shared pure helpers define identifiers, validation, filtering, and safe create/update payload behavior; server pages read the global setting, while an authenticated Admin Server Action saves it. Display consumers receive only visible fields, but import/export code continues to use complete records independently.

**Tech Stack:** Next.js 16.3 App Router and Server Actions, React 19, TypeScript, Zod, Supabase/Postgres with RLS, node:test via `tsx`, pgTAP/Supabase CLI, T3 collaborative preview.

## Global Constraints

- The saved configuration is global: every website user sees the same field set for a database table.
- Only active Admin users may change field visibility; active authenticated users may read it.
- Hidden fields are omitted from results, record view, record edit, and manual new-record entry.
- Existing hidden values must survive edits unchanged, and crafted submissions must not mutate hidden fields.
- CSV import parsing, templates, inserted values, and CSV export columns/values remain unchanged.
- Search filters and query behavior remain unchanged.
- Store stable identifiers as `core:<field_key>` and `extra:<exact label>`.
- Missing settings mean all fields are visible; settings read errors must fail closed rather than reveal hidden fields.
- At least one available field must remain visible.
- Preserve the pre-existing uncommitted CoStar/import work. In particular, `app/(app)/land-sales/actions.ts` already contains unrelated edits and must be staged by feature hunks only.
- Before editing Next.js forms or actions, follow the installed guides at `node_modules/next/dist/docs/01-app/02-guides/forms.md`, `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, and `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`.
- Supabase public tables need explicit grants as well as RLS. Follow the current official guidance at `https://supabase.com/docs/guides/api/securing-your-api` and `https://supabase.com/docs/guides/database/postgres/row-level-security`.

---

### Task 1: Define and test the shared field-visibility model

**Files:**
- Create: `lib/land-sales/field-visibility.ts`
- Create: `lib/land-sales/field-visibility.test.ts`
- Modify: `lib/land-sales/result-columns.ts`
- Modify: `lib/land-sales/result-columns.test.ts`

**Interfaces:**
- Consumes: `ResultColumn`, `CoreResultField`, `DetailSheet`, and `resultColumns()` from `lib/land-sales/result-columns.ts`.
- Produces: `DatabaseKey`, `SALES_DATABASE_KEY`, `fieldVisibilityId()`, `filterVisibleColumns()`, `filterVisibleDetailSheets()`, `buildRecordDisplaySheets()`, `validateVisibleFieldIds()`, `visibleCoreField()`, and `visibleExtraField()`.

- [ ] **Step 1: Write failing identifier and filtering tests**

Create `lib/land-sales/field-visibility.test.ts` with these focused cases:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fieldVisibilityId,
  filterVisibleColumns,
  filterVisibleDetailSheets,
  buildRecordDisplaySheets,
  validateVisibleFieldIds,
} from './field-visibility.ts';
import { DETAIL_SHEETS, resultColumns } from './result-columns.ts';

describe('field visibility identifiers', () => {
  it('namespaces core and custom fields so labels cannot collide', () => {
    assert.equal(fieldVisibilityId({ kind: 'core', key: 'city', label: 'City' }), 'core:city');
    assert.equal(fieldVisibilityId({ kind: 'extra', key: 'city', label: 'city' }), 'extra:city');
  });
});

describe('field visibility filtering', () => {
  const columns = resultColumns({ catalogLabels: ['Zoning'] });

  it('shows everything when the hidden set is empty', () => {
    assert.deepEqual(filterVisibleColumns(columns, new Set()).map(fieldVisibilityId), columns.map(fieldVisibilityId));
  });

  it('removes hidden core and custom columns', () => {
    const visible = filterVisibleColumns(columns, new Set(['core:address', 'extra:Zoning']));
    assert.equal(visible.some(column => fieldVisibilityId(column) === 'core:address'), false);
    assert.equal(visible.some(column => fieldVisibilityId(column) === 'extra:Zoning'), false);
  });

  it('drops empty sections and sheets from record details', () => {
    const allButBuyer = new Set(columns.map(fieldVisibilityId).filter(id => id !== 'core:buyer'));
    const sheets = filterVisibleDetailSheets(DETAIL_SHEETS, allButBuyer);
    assert.deepEqual(sheets.map(sheet => sheet.id), ['transaction']);
    assert.deepEqual(sheets[0].sections.flatMap(section => section.fields.map(field => field.key)), ['buyer']);
  });

  it('keeps a usable Additional Fields sheet for a custom-only configuration', () => {
    const hiddenCore = new Set(columns.filter(column => column.kind === 'core').map(fieldVisibilityId));
    const sheets = buildRecordDisplaySheets(DETAIL_SHEETS, columns, hiddenCore);
    assert.deepEqual(sheets.map(sheet => sheet.id), ['additional']);
    assert.deepEqual(sheets[0].extraColumns.map(column => column.key), ['Zoning']);
  });
});

describe('visible-field validation', () => {
  const columns = resultColumns({ catalogLabels: ['Zoning'] });

  it('rejects an empty selection', () => {
    assert.deepEqual(validateVisibleFieldIds([], columns), { ok: false, message: 'At least one field must remain visible.' });
  });

  it('rejects unknown and duplicate identifiers', () => {
    assert.equal(validateVisibleFieldIds(['core:city', 'core:missing'], columns).ok, false);
    assert.equal(validateVisibleFieldIds(['core:city', 'core:city'], columns).ok, false);
  });

  it('derives the normalized hidden set from the authoritative columns', () => {
    const result = validateVisibleFieldIds(['core:city', 'extra:Zoning'], columns);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.hiddenFieldIds.includes('core:city'), false);
  });
});
```

- [ ] **Step 2: Run the focused tests and verify the red state**

Run:

```powershell
npx tsx --test 'lib/land-sales/field-visibility.test.ts' 'lib/land-sales/result-columns.test.ts'
```

Expected: FAIL because `field-visibility.ts` and its exports do not exist.

- [ ] **Step 3: Implement the pure visibility module**

Export `CORE_RESULT_COLUMNS` as a readonly array from `result-columns.ts`, then implement these exact contracts in `field-visibility.ts`:

```ts
export type DatabaseKey = 'sales';
export const SALES_DATABASE_KEY: DatabaseKey = 'sales';
export type HiddenFieldIds = ReadonlySet<string>;

export function fieldVisibilityId(column: ResultColumn): string;
export function visibleCoreField(field: CoreResultField, hidden: HiddenFieldIds): boolean;
export function visibleExtraField(label: string, hidden: HiddenFieldIds): boolean;
export function filterVisibleColumns(columns: ResultColumn[], hidden: HiddenFieldIds): ResultColumn[];
export function filterVisibleDetailSheets(sheets: DetailSheet[], hidden: HiddenFieldIds): DetailSheet[];
export type RecordDisplaySheet = DetailSheet & {
  extraColumns: Extract<ResultColumn, { kind: 'extra' }>[];
};
export function buildRecordDisplaySheets(
  sheets: DetailSheet[],
  columns: ResultColumn[],
  hidden: HiddenFieldIds,
): RecordDisplaySheet[];

export type VisibleFieldValidation =
  | { ok: true; hiddenFieldIds: string[] }
  | { ok: false; message: string };

export function validateVisibleFieldIds(
  visibleFieldIds: string[],
  availableColumns: ResultColumn[],
): VisibleFieldValidation;
```

`filterVisibleDetailSheets()` must clone sheets and sections, filter by `visibleCoreField()`, and remove empty sections and sheets. `buildRecordDisplaySheets()` appends visible extras to the last visible core sheet, or returns a synthetic `additional` sheet when extras are visible but no core sheet remains. `validateVisibleFieldIds()` must reject zero selections, duplicates, and identifiers outside the authoritative column list; on success it returns every authoritative identifier not selected, in column order.

- [ ] **Step 4: Run the focused tests and verify the green state**

Run:

```powershell
npx tsx --test 'lib/land-sales/field-visibility.test.ts' 'lib/land-sales/result-columns.test.ts'
```

Expected: all identifier, collision, validation, result-column, and detail-sheet tests PASS.

- [ ] **Step 5: Commit the shared model**

Run:

```powershell
git add -- 'lib/land-sales/field-visibility.ts' 'lib/land-sales/field-visibility.test.ts' 'lib/land-sales/result-columns.ts' 'lib/land-sales/result-columns.test.ts'
git diff --cached --check
git commit -m 'add global field visibility model'
```

Expected: one commit containing only the shared model and tests.

---

### Task 2: Add the Supabase settings table, grants, and RLS

**Files:**
- Create via CLI: the timestamped file produced by `supabase migration new create_result_display_settings`
- Create: `supabase/tests/result_display_settings_rls.sql`
- Create: `lib/land-sales/display-settings.ts`
- Create: `lib/land-sales/display-settings.test.ts`

**Interfaces:**
- Consumes: existing `public.current_user_role()` and `public.current_user_active()` functions.
- Produces: `public.result_display_settings`, `loadHiddenFieldIds(supabase, databaseKey): Promise<Set<string>>`, and `DisplaySettingsReadError`.

- [ ] **Step 1: Create the migration with the Supabase CLI**

Run:

```powershell
supabase --version
supabase migration new create_result_display_settings
$visibilityMigration = Get-ChildItem 'supabase/migrations/*_create_result_display_settings.sql' | Sort-Object Name | Select-Object -Last 1
if (-not $visibilityMigration) { throw 'Supabase did not create the migration file.' }
$visibilityMigration.FullName
```

Expected: CLI version 2.111.0 or newer and exactly one newly created timestamped migration path. Use that printed path for the remainder of this task; do not rename it manually.

- [ ] **Step 2: Write the failing pgTAP contract test**

Create `supabase/tests/result_display_settings_rls.sql` to assert:

```sql
begin;
select plan(8);

select has_table('public', 'result_display_settings', 'settings table exists');
select col_is_pk('public', 'result_display_settings', 'database_key', 'database_key is the primary key');
select col_type_is('public', 'result_display_settings', 'hidden_field_keys', 'text[]', 'hidden keys use text[]');
select policies_are(
  'public',
  'result_display_settings',
  array[
    'active users can read result display settings',
    'admins can insert result display settings',
    'admins can update result display settings',
    'admins can delete result display settings'
  ],
  'all four policies are installed'
);
select table_privs_are('public', 'result_display_settings', 'anon', array[]::text[], 'anon has no table grants');
select table_privs_are('public', 'result_display_settings', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'authenticated receives minimum Data API grants');
select isnt_empty(
  $$select 1 from pg_policies where schemaname = 'public' and tablename = 'result_display_settings' and cmd = 'SELECT' and qual like '%current_user_active%'$$,
  'read policy requires an active user'
);
select isnt_empty(
  $$select 1 from pg_policies where schemaname = 'public' and tablename = 'result_display_settings' and cmd in ('INSERT', 'UPDATE', 'DELETE') and coalesce(qual, with_check, '') like '%Admin%'$$,
  'write policies require Admin'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Run the database test and verify the red state**

Run against the local Supabase stack:

```powershell
supabase test db --local 'supabase/tests/result_display_settings_rls.sql'
```

Expected: FAIL because `public.result_display_settings` does not exist. If the local stack is not running, start it with `supabase start`, then rerun; do not target the shared project for the red test.

- [ ] **Step 4: Implement the migration**

Put this schema, grant, and policy shape in the CLI-generated migration:

```sql
create table public.result_display_settings (
  database_key text primary key,
  hidden_field_keys text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.result_display_settings enable row level security;

revoke all on table public.result_display_settings from anon, authenticated;
grant select, insert, update, delete on table public.result_display_settings to authenticated;

create policy "active users can read result display settings"
  on public.result_display_settings for select to authenticated
  using (public.current_user_active());

create policy "admins can insert result display settings"
  on public.result_display_settings for insert to authenticated
  with check (public.current_user_active() and public.current_user_role() = 'Admin');

create policy "admins can update result display settings"
  on public.result_display_settings for update to authenticated
  using (public.current_user_active() and public.current_user_role() = 'Admin')
  with check (public.current_user_active() and public.current_user_role() = 'Admin');

create policy "admins can delete result display settings"
  on public.result_display_settings for delete to authenticated
  using (public.current_user_active() and public.current_user_role() = 'Admin');
```

- [ ] **Step 5: Write failing loader tests**

In `display-settings.test.ts`, use a minimal fluent fake for `.from().select().eq().maybeSingle()` and cover these outcomes:

```ts
it('returns an empty set when no row exists', async () => {
  assert.deepEqual([...await loadHiddenFieldIds(fakeClient({ data: null, error: null }), 'sales')], []);
});

it('returns the saved hidden identifiers', async () => {
  const hidden = await loadHiddenFieldIds(fakeClient({ data: { hidden_field_keys: ['core:address'] }, error: null }), 'sales');
  assert.deepEqual([...hidden], ['core:address']);
});

it('throws a typed error instead of failing open', async () => {
  await assert.rejects(
    loadHiddenFieldIds(fakeClient({ data: null, error: { message: 'permission denied' } }), 'sales'),
    DisplaySettingsReadError,
  );
});
```

Run `npx tsx --test 'lib/land-sales/display-settings.test.ts'` and expect FAIL because the loader does not exist.

- [ ] **Step 6: Implement the fail-closed loader**

Implement:

```ts
export class DisplaySettingsReadError extends Error {}

export async function loadHiddenFieldIds(
  supabase: SupabaseClient,
  databaseKey: DatabaseKey,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('result_display_settings')
    .select('hidden_field_keys')
    .eq('database_key', databaseKey)
    .maybeSingle();
  if (error) throw new DisplaySettingsReadError(error.message);
  return new Set((data?.hidden_field_keys as string[] | null) ?? []);
}
```

- [ ] **Step 7: Apply locally and run database plus loader tests**

Run:

```powershell
supabase db reset --local
supabase test db --local 'supabase/tests/result_display_settings_rls.sql'
npx tsx --test 'lib/land-sales/display-settings.test.ts'
supabase migration list --local
```

Expected: migration applies; all 8 pgTAP assertions and all loader tests PASS; the generated migration appears in the local migration list. If the existing untracked CoStar migration fails during reset, report its exact failure and validate this migration in a clean local branch/worktree rather than editing unrelated SQL.

- [ ] **Step 8: Commit the persistence layer**

Run:

```powershell
$visibilityMigration = Get-ChildItem 'supabase/migrations/*_create_result_display_settings.sql' | Sort-Object Name | Select-Object -Last 1
git add -- $visibilityMigration.FullName 'supabase/tests/result_display_settings_rls.sql' 'lib/land-sales/display-settings.ts' 'lib/land-sales/display-settings.test.ts'
git diff --cached --check
git commit -m 'add result display settings storage'
```

Expected: one commit containing only the generated migration, RLS contract test, loader, and loader tests.

---

### Task 3: Build the Admin visibility editor and save action

**Files:**
- Create: `app/(app)/admin/database-manager/schema/actions.ts`
- Create: `components/admin/field-visibility-form.tsx`
- Create: `lib/admin/field-visibility-action.ts`
- Create: `lib/admin/field-visibility-action.test.ts`
- Modify: `app/(app)/admin/database-manager/schema/page.tsx`

**Interfaces:**
- Consumes: `resultColumns()`, `loadHiddenFieldIds()`, `validateVisibleFieldIds()`, `getCurrentUserProfile()`, and `logAudit()`.
- Produces: `saveFieldVisibilityAction(previousState, formData): Promise<FieldVisibilityActionState>` and `FieldVisibilityForm`.

- [ ] **Step 1: Write failing action-input tests**

Extract a pure parser in `lib/admin/field-visibility-action.ts` and test:

```ts
assert.deepEqual(
  parseVisibilitySubmission(formData([['database_key', 'sales'], ['visible_field_id', 'core:city']]), columns),
  { ok: true, databaseKey: 'sales', hiddenFieldIds: expectedHidden },
);
assert.equal(parseVisibilitySubmission(formData([['database_key', 'rentals']]), columns).ok, false);
assert.equal(parseVisibilitySubmission(formData([['database_key', 'sales']]), columns).ok, false);
assert.equal(parseVisibilitySubmission(formData([['database_key', 'sales'], ['visible_field_id', 'core:unknown']]), columns).ok, false);
```

Run `npx tsx --test 'lib/admin/field-visibility-action.test.ts'` and expect FAIL because the parser does not exist.

- [ ] **Step 2: Implement and pass the pure parser tests**

Implement:

```ts
export function parseVisibilitySubmission(
  formData: FormData,
  availableColumns: ResultColumn[],
):
  | { ok: true; databaseKey: DatabaseKey; hiddenFieldIds: string[] }
  | { ok: false; message: string };
```

Accept only `database_key === 'sales'`. Read repeated `visible_field_id` strings and delegate duplicate, unknown, and empty validation to `validateVisibleFieldIds()`. Run the focused test and expect PASS.

- [ ] **Step 3: Implement the authenticated Server Action**

In `schema/actions.ts`:

```ts
'use server';

export type FieldVisibilityActionState =
  | { status: 'success'; message: string; hiddenFieldIds: string[] }
  | { status: 'error'; message: string }
  | null;

export async function saveFieldVisibilityAction(
  _previousState: FieldVisibilityActionState,
  formData: FormData,
): Promise<FieldVisibilityActionState>;
```

The action must:

1. create the request-scoped Supabase client;
2. load the current profile and reject missing, suspended, or non-Admin profiles;
3. query the authoritative custom-field catalog;
4. build `resultColumns({ catalogLabels })` and parse the submission;
5. call `.upsert({ database_key: 'sales', hidden_field_keys, updated_at: new Date().toISOString(), updated_by: profile.id }, { onConflict: 'database_key' })`;
6. return a useful database error without logging success;
7. log `Updated Field Visibility` with visible/total counts;
8. call `revalidatePath('/admin/database-manager/schema')`, `revalidatePath('/land-sales')`, and `revalidatePath('/land-sales/[id]', 'page')`; and
9. return the saved hidden identifiers so the client can reset its dirty baseline.

- [ ] **Step 4: Implement the client editor**

`FieldVisibilityForm` receives:

```ts
type FieldVisibilityFormProps = {
  databaseKey: DatabaseKey;
  columns: ResultColumn[];
  initialHiddenFieldIds: string[];
  disabledReason?: string;
};
```

Use `useActionState(saveFieldVisibilityAction, null)`. Render a checkbox or switch for every column, with checked meaning visible and a repeated `name="visible_field_id"` value from `fieldVisibilityId(column)`. Maintain visible IDs in component state so `Show All`, dirty detection, and the at-least-one message respond immediately. Include `aria-live="polite"` for save/error messages. Disable Save when unchanged, pending, no field is visible, or `disabledReason` exists.

- [ ] **Step 5: Replace the schema placeholder with the editor**

Update the server page to query the custom-field catalog and `loadHiddenFieldIds()` in parallel after Admin authorization. Build all columns with `resultColumns({ catalogLabels })`. On settings or catalog errors, render the complete field list but pass a non-empty `disabledReason` so the form cannot overwrite an unknown configuration.

Change the copy to `Results & Record Display` and explicitly mention results, record details, new-record entry, global scope, unchanged stored data, and unchanged imports/exports. Remove the old static `Visible in Search` badges and the copy directing Admins to Supabase for this presentation setting.

- [ ] **Step 6: Verify focused tests and static checks**

Run:

```powershell
npx tsx --test 'lib/admin/field-visibility-action.test.ts' 'lib/land-sales/field-visibility.test.ts'
npm run lint
npx tsc --noEmit
```

Expected: tests, ESLint, and TypeScript PASS.

- [ ] **Step 7: Commit only Admin configuration work**

Run:

```powershell
git add -- 'app/(app)/admin/database-manager/schema/actions.ts' 'app/(app)/admin/database-manager/schema/page.tsx' 'components/admin/field-visibility-form.tsx' 'lib/admin/field-visibility-action.ts' 'lib/admin/field-visibility-action.test.ts'
git diff --cached --check
git commit -m 'add admin field visibility controls'
```

Expected: one Admin UI/action commit with no unrelated land-sales import changes.

---

### Task 4: Apply visibility to results without changing CSV export

**Files:**
- Modify: `app/(app)/land-sales/page.tsx`
- Modify: `components/land-sales/results-table.tsx`

**Interfaces:**
- Consumes: `loadHiddenFieldIds()`, `SALES_DATABASE_KEY`, `filterVisibleColumns()`, and the complete `resultColumns()` output.
- Produces: a `ResultsTable` that receives only visible display columns while `makeCsv(selected)` continues to receive complete records.

- [ ] **Step 1: Run the pre-change filtering and CSV safety net**

Run:

```powershell
npx tsx --test 'lib/land-sales/result-columns.test.ts' 'lib/land-sales/csv.test.ts'
```

Expected: the Task 1 visibility helper tests and the existing CSV serialization tests PASS. This establishes that the integration can filter the display list without modifying export code.

- [ ] **Step 2: Load and apply settings on the results page**

Add the settings query to the existing `Promise.all()`. Preserve the complete `columns` local, then create:

```ts
const visibleColumns = filterVisibleColumns(columns, hiddenFieldIds);
return (
  <ResultsTable
    records={records}
    columns={visibleColumns}
    canEdit={canEdit(profile?.role ?? 'Viewer')}
    filters={filters}
  />
);
```

Do not pass `visibleColumns` into CSV serialization or change `makeCsv()`.

- [ ] **Step 3: Centralize the existing table column key**

Remove the private `columnId()` from `results-table.tsx` and use `fieldVisibilityId()` for React keys and identity. Keep sort, row selection, action buttons, and empty-state `colSpan` based on the filtered `columns` prop.

- [ ] **Step 4: Run tests and commit**

Run:

```powershell
npx tsx --test 'lib/land-sales/result-columns.test.ts' 'lib/land-sales/csv.test.ts'
npm run lint
npx tsc --noEmit
git add -- 'app/(app)/land-sales/page.tsx' 'components/land-sales/results-table.tsx'
git diff --cached --check
git commit -m 'apply field visibility to results'
```

Expected: tests and static checks PASS; commit contains no change to CSV production code.

---

### Task 5: Hide fields on record view/edit while preserving stored values

**Files:**
- Create: `lib/land-sales/visible-record-input.ts`
- Create: `lib/land-sales/visible-record-input.test.ts`
- Modify: `app/(app)/land-sales/[id]/page.tsx`
- Modify: `components/land-sales/record-details.tsx`
- Modify carefully by feature hunks: `app/(app)/land-sales/actions.ts`

**Interfaces:**
- Consumes: hidden IDs, complete custom catalog labels, `buildRecordDisplaySheets()`, `visibleCoreField()`, `landSaleInputSchema`, and the existing record.
- Produces: `mergeVisibleUpdate(existing, submitted, visibleExtraLabels, hidden): LandSaleInput` and a filtered `RecordDetails` UI.

- [ ] **Step 1: Write failing preservation tests**

Create tests that prove:

```ts
const existing = landSaleInputSchema.parse({
  address: 'Stored Address',
  city: 'Austin',
  buyer: 'Stored Buyer',
  extras: { Zoning: 'C-2', Market: 'Austin' },
});
const submitted = landSaleInputSchema.parse({
  address: 'Crafted replacement',
  city: 'Dallas',
  buyer: '',
  extras: { Zoning: 'Crafted', Market: '' },
});
const merged = mergeVisibleUpdate(
  existing,
  submitted,
  ['Zoning', 'Market'],
  new Set(['core:address', 'extra:Zoning']),
);
assert.equal(merged.address, 'Stored Address');
assert.equal(merged.city, 'Dallas');
assert.equal(merged.extras.Zoning, 'C-2');
assert.equal('Market' in merged.extras, false);
```

Also test that hidden custom keys not present in the current catalog remain preserved, and that visible blank fields clear as they do today.

Run `npx tsx --test 'lib/land-sales/visible-record-input.test.ts'` and expect FAIL because the merge helper does not exist.

- [ ] **Step 2: Implement the preservation helper**

Implement exact contracts:

```ts
export function mergeVisibleUpdate(
  existing: LandSaleInput,
  submitted: LandSaleInput,
  catalogLabels: string[],
  hidden: HiddenFieldIds,
): LandSaleInput;
```

For writable core keys, take `existing[key]` when `core:<key>` is hidden and the submitted value otherwise. Always preserve derived/system fields outside the manual payload. For extras, begin with existing extras during update, ignore client values for hidden labels, apply visible catalog labels, and delete a visible label when its submitted value is blank. Run the focused tests and expect PASS.

- [ ] **Step 3: Filter record presentation and header content**

Load settings in `[id]/page.tsx` and pass `hiddenFieldIds` to `RecordDetails`. In the component:

- derive `visibleSheets = buildRecordDisplaySheets(DETAIL_SHEETS, resultColumns({ catalogLabels, records: [record] }), hidden)`;
- use `visibleSheets` for tabs, panels, active index, and error-sheet navigation;
- omit header tags/subtitle fragments whose source fields are hidden;
- build the title only from visible address/city/state fields, otherwise use `Land Sale Record`; and
- keep the existing inactive-sheet mounted behavior for the remaining visible sheets.

Do not render hidden inputs containing hidden record values.

- [ ] **Step 4: Make the update action authoritative and preservation-safe**

In `updateLandSale`, after authorization and before parsing the final payload, query in parallel:

```ts
const [{ data: existing, error: existingError }, { data: customRows, error: customError }, hiddenFieldIds] = await Promise.all([
  supabase.from('land_sales').select('*').eq('id', id).maybeSingle(),
  supabase.from('land_sales_custom_fields').select('label').order('label'),
  loadHiddenFieldIds(supabase, SALES_DATABASE_KEY),
]);
```

Reject missing records and either read error. Parse the submitted visible form using the existing schema, call `mergeVisibleUpdate()`, then write the merged payload. Ignore crafted values for hidden fields. Preserve the current `from` redirect and `sale_date_raw` behavior for visible date edits; if Sale Date is hidden, preserve both stored `sale_date` and `sale_date_raw`.

- [ ] **Step 5: Run preservation, schema, and detail-layout tests**

Run:

```powershell
npx tsx --test 'lib/land-sales/visible-record-input.test.ts' 'lib/land-sales/result-columns.test.ts' 'lib/land-sales/schema.test.ts' 'lib/land-sales/visible-action-state.test.ts'
npm run lint
npx tsc --noEmit
```

Expected: all focused tests and static checks PASS.

- [ ] **Step 6: Stage feature hunks and commit without the existing CoStar edits**

Run:

```powershell
git add -- 'lib/land-sales/visible-record-input.ts' 'lib/land-sales/visible-record-input.test.ts' 'app/(app)/land-sales/[id]/page.tsx' 'components/land-sales/record-details.tsx'
git add -p -- 'app/(app)/land-sales/actions.ts'
git diff --cached --check
git diff --cached
```

Confirm the cached diff contains only field-visibility imports and update-preservation logic; reject any existing CoStar/import hunks. Then run:

```powershell
git commit -m 'apply field visibility to record details'
```

Expected: unrelated uncommitted action changes remain in the working tree after the commit.

---

### Task 6: Mirror visibility on manual new-record entry

**Files:**
- Modify: `app/(app)/land-sales/new/page.tsx`
- Modify: `components/land-sales/land-sale-form.tsx`
- Modify carefully by feature hunks: `app/(app)/land-sales/actions.ts`
- Modify: `lib/land-sales/visible-record-input.test.ts`

**Interfaces:**
- Consumes: the complete result-column catalog, hidden IDs, `sanitizeVisibleCreate()`, and existing create authorization.
- Produces: `LandSaleForm({ columns, hiddenFieldIds })` rendering the same visible field set as record edit mode.

- [ ] **Step 1: Add failing create-sanitization coverage**

Add cases proving a crafted hidden core value and hidden custom value are discarded, visible values survive, blank visible extras are absent, and a visible computed `price_per_acre` is not accepted as user input.

Run `npx tsx --test 'lib/land-sales/visible-record-input.test.ts'` and expect FAIL because `sanitizeVisibleCreate()` does not exist yet.

- [ ] **Step 2: Load the authoritative field context on the new page**

After existing role authorization, query custom labels and hidden settings. Build complete columns and pass them with the hidden ID array into `LandSaleForm`. Treat either settings or catalog read errors as page errors; do not fall back to all fields.

- [ ] **Step 3: Render the same visible field set as edit mode**

First implement and export:

```ts
export function sanitizeVisibleCreate(
  submitted: LandSaleInput,
  catalogLabels: string[],
  hidden: HiddenFieldIds,
): LandSaleInput;
```

Then refactor `LandSaleForm` to use `buildRecordDisplaySheets()` so it derives the same visible core/detail sheets and visible extra columns as record edit. Render visible custom fields using `extraInputName(label)`. Render `price_per_acre`, when visible, as a read-only `Calculated after save` field rather than a submitted input. Remove empty sections and sheets; the shared builder supplies one `Additional Fields` sheet when custom fields are the only visible fields. Preserve the existing action-state errors, pending state, save button, and Back link.

- [ ] **Step 4: Sanitize create submissions on the server**

In `createLandSale`, after authorization, load custom labels and hidden settings. Extract custom inputs with `extrasFromFormData(formData)`, combine them into the raw object as `extras`, validate with `landSaleInputSchema`, call `sanitizeVisibleCreate()`, and insert the sanitized data. This server-side step must ignore crafted fields hidden since the page was rendered. Keep CSV import code entirely separate and unchanged.

- [ ] **Step 5: Run focused tests and static validation**

Run:

```powershell
npx tsx --test 'lib/land-sales/visible-record-input.test.ts' 'lib/land-sales/schema.test.ts' 'lib/land-sales/csv.test.ts'
npm run lint
npx tsc --noEmit
```

Expected: create sanitization, schema, and CSV regression tests PASS.

- [ ] **Step 6: Stage feature hunks and commit**

Run:

```powershell
git add -- 'app/(app)/land-sales/new/page.tsx' 'components/land-sales/land-sale-form.tsx' 'lib/land-sales/visible-record-input.test.ts'
git add -p -- 'app/(app)/land-sales/actions.ts'
git diff --cached --check
git diff --cached
git commit -m 'apply field visibility to manual entry'
```

Expected: the cached action hunks affect only `createLandSale`; import changes remain unstaged.

---

### Task 7: Verify authorization and the complete user flow

**Files:**
- Modify only if a defect is found: files from Tasks 1-6

**Interfaces:**
- Consumes: the complete feature.
- Produces: evidence that Admin settings are global, hidden values are preserved, non-Admins cannot write settings, and CSV behavior is unchanged.

- [ ] **Step 1: Run the complete automated suite**

Run:

```powershell
npx tsx --test 'lib/**/*.test.ts'
supabase test db --local 'supabase/tests/result_display_settings_rls.sql'
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all tests, RLS assertions, lint, typecheck, build, and whitespace checks PASS. If unrelated dirty work causes a failure, capture the exact command/output and rerun against the feature commit state in an isolated worktree.

- [ ] **Step 2: Verify RLS with real role contexts**

Using a local database or Supabase's RLS Tester, verify each operation twice where applicable:

```text
Active Viewer: SELECT allowed; INSERT/UPDATE/DELETE denied
Active Editor: SELECT allowed; INSERT/UPDATE/DELETE denied
Active Admin: SELECT/INSERT/UPDATE/DELETE allowed
Suspended Admin: SELECT/INSERT/UPDATE/DELETE denied
Anonymous: no table access
```

Also run database advisors (`supabase db advisors --local` when supported, otherwise the connected Supabase advisor) and resolve any finding introduced by this migration.

- [ ] **Step 3: Start the app and perform the Admin browser flow**

Start or reuse the local server, then use the T3 collaborative preview:

```text
1. Sign in as Admin and open /admin/database-manager/schema?db=sales.
2. Hide Address and one custom field; Save Changes.
3. Refresh and confirm both controls remain hidden.
4. Open /land-sales and confirm both columns are absent.
5. Open a record and confirm neither value appears in header, sheets, or Additional Fields.
6. Enter edit mode and confirm neither field is rendered.
7. Open /land-sales/new and confirm neither field is rendered.
8. Edit and save a visible field, then show all fields as Admin and confirm the original hidden values are intact.
9. Use Show All, save, and confirm the fields return everywhere.
```

Check for framework overlays and new console errors on each route.

- [ ] **Step 4: Verify global visibility and authorization with a second user**

Sign in as an Editor or Viewer after the Admin hides the two fields. Confirm the same fields are absent on results and record details. Attempt a direct settings-table write using that user's authenticated context and confirm RLS denies it. Confirm the Database Manager route redirects the non-Admin.

- [ ] **Step 5: Verify import/export independence**

With Address and the custom field hidden:

```text
1. Select a record containing both values and export CSV.
2. Confirm the CSV still contains both headers and values.
3. Import a valid CSV containing a hidden supported field.
4. Confirm the import succeeds and the value is stored.
5. Confirm the value remains absent from configured UI surfaces.
6. Show the field again and confirm the imported value appears.
```

- [ ] **Step 6: Review the final diff and repository state**

Run:

```powershell
git log --oneline --decorate -8
git status --short
git diff --check
git diff HEAD -- 'app/(app)/land-sales/actions.ts' 'components/land-sales/import-client.tsx' 'lib/land-sales/csv.ts' 'lib/land-sales/csv.test.ts' 'lib/land-sales/costar-fields.ts' 'lib/land-sales/costar-fields.test.ts' 'supabase/migrations/20260823015605_add_costar_land_sales_columns.sql'
```

Expected: feature commits are present; only the user's pre-existing unrelated edits remain uncommitted; no feature commit accidentally absorbed CoStar/import work.

- [ ] **Step 7: Commit any verification-only fixes and record evidence**

If verification required a feature fix, rerun the smallest red/green test, then the full suite, and commit only that fix:

```powershell
git add -p
git diff --cached --check
git commit -m 'fix field visibility verification findings'
```

If no fix was required, do not create an empty commit. Report the successful commands, browser flows, migration/RLS results, and any explicitly unrelated remaining working-tree changes.
