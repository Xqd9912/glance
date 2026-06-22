## Why

Loaded structures already carry element colors in the preview scene, but the
browser preview does not explain which color corresponds to which element. A
small element legend makes the preview easier to read while keeping the current
full-window canvas direction.

## What Changes

- Add a read-only element legend to the loaded structure preview.
- Derive legend entries from the currently loaded scene atoms, using each
  element's existing symbol and color.
- Show the legend as a bottom figure overlay over the full-bleed preview canvas,
  separate from the left interaction card.
- Preserve the modern full-window canvas; define preview safe areas so the
  structure is not hidden behind the left card or bottom legend.
- Record that future figure export should treat the legend as part of the
  exported figure when the legend is visible, without implementing export in
  this change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `structure-preview`: Adds the element legend and preview layout boundary to
  the browser structure preview behavior.

## Impact

- Frontend preview components and styling.
- Frontend scene-derived display state for unique element legend entries.
- Frontend visual tests or component tests covering legend visibility and
  element ordering.
- No Python API contract changes are expected because existing atom records
  already include element symbols and colors.
