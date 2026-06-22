## 1. Legend Data And Rendering

- [x] 1.1 Add frontend logic that derives unique legend entries from the loaded scene atoms in first-seen element order.
- [x] 1.2 Render the legend only for a valid loaded scene, with fixed-size sphere markers and element symbols.
- [x] 1.3 Style the legend as a restrained bottom figure overlay that stays separate from the left interaction card.

## 2. Preview Layout Boundary

- [x] 2.1 Keep the preview canvas full-window without adding a visible canvas frame.
- [x] 2.2 Add simple preview safe-area framing so the primary structure view avoids the left card and bottom legend regions.
- [x] 2.3 Ensure empty, loading, and parse-error states do not show the legend.

## 3. Verification

- [x] 3.1 Add or update frontend checks for unique legend entries, first-seen ordering, and hidden states.
- [x] 3.2 Run the existing Python and frontend checks affected by the structure preview flow.
- [x] 3.3 Visually verify the loaded preview: full-bleed canvas, bottom legend, left card, and no obvious overlap.
