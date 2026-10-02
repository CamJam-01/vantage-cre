# Temporary results-column resizing

Approved scope: Land and Improved results share drag and keyboard resizing.
Each visible field has a focusable separator at the header’s right edge.
Left/Right adjust by 16 px; Home/End choose the 64/1600 px bounds.
Header and body widths stay aligned. Resizing does not activate sorting.
Widths reset on reload and when switching sales paths. No stored preferences,
record changes, arrangement changes, or import/export changes are introduced.

Reuse the shared table and default heading-width calculation. Preview widths
through its colgroup during pointer movement, then commit React state on release
to avoid rerendering every cell on each pointer event. Cancellation restores
the original width. Verify both paths, keyboard controls, bounds, cancellation,
alignment, sorting, and reload resets, plus the repository checks.
