# DOCX Output Router

## Intent

An Admin can define a named Output Flow such as **Land Comps**. A Viewer picks
that one output for a selected record set; each record is routed to a saved
template by ordered field conditions, with a required default template handling
everything that does not match.

## Rules

- Conditions are evaluated top-to-bottom for each record; the first match wins.
- Operators are `contains`, `equals`, and `does not equal`.
- Comparisons are case-insensitive text comparisons over stored catalog values.
- Routing reads full records and may test hidden fields.
- The final DOCX preserves selected-record order and `{{ comp_number }}` remains
  sequential across template changes.
- The flow's default template owns package-wide page setup, headers, footers,
  styles, numbering, themes, and fonts. Alternate templates contribute body
  content and must use compatible supporting Word parts; an incompatible flow
  fails visibly instead of returning a corrupt document.
- Output Flows are global Admin configuration. Active users may read and use
  them; only active Admins may create, edit, or delete them.
- A saved template referenced by a flow cannot be deleted until the flow is
  changed or removed.

## Acceptance example

For **Land Comps**, default template **Land Sales**, and condition **Sale Status
does not equal Sold → Land Listings**, records with `Sale Status = Sold` use the
Sales body and all other records use the Listings body in the same download.
