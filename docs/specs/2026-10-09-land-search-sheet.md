# Land Sales search sheet

Replace the Location / Type / Size / Time wizard on Land and Improved Sales
search with a record-details look: the Admin arrangement's pages and groups,
type-aware field filters (text contains, number min/max, date from/to, boolean
is), and a single Search action in the sticky bar. Fields start blank; legacy
primary URL params seed matching blanks. Submit encodes only `fieldFilters`.
Ten high-traffic text fields use a DB-backed searchable combobox with parent→
child scoping (City/County/Market←State, Submarket←Market, Secondary Type /
Proposed Use←Property Type).
