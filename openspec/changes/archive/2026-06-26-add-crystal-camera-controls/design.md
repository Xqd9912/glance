## Context

The preview already has Trackball/Orbit drag rotation, bounded zoom, reset, lock, export orientation snapshots, and a lower-left orientation gizmo. The `Camera` tab in the left common-controls panel is still a reserved page, and the current loaded/reset orientation is a Standard three-quarter pose.

This change turns camera direction into a crystal-aware control surface. Users should be able to choose whether the main constraint is the screen-up direction or the screen-outward direction, use the gizmo for quick `a`, `b`, `c` choices, adjust the remaining roll degree of freedom, and use fixed precise vector input when needed.

## Goals / Non-Goals

**Goals:**

- Make the `Camera` tab an implemented panel using the existing tab, input, slider, and segmented-control visual language.
- Represent user-facing camera direction with direct and reciprocal lattice coordinates, while continuing to store and export the rendered pose as a quaternion.
- Use a VESTA-like default and reset pose: `Primary Axis = Outward`, `Outward = c`, `Upward = b*`, `Roll = 0°`.
- Keep quick controls light: Primary Axis tabs, live roll angle control with reset, clickable gizmo axes, and a fixed Manual vector editor.
- Keep precise vector edits batch-applied, so partially typed six-field input does not rotate the preview.

**Non-Goals:**

- Adding saved camera presets or a camera-preset library.
- Adding negative-axis gizmo endpoints in the first version; negative directions remain possible through vector input.
- Moving Trackball/Orbit mode out of the right Advanced Settings drawer.

## Decisions

### Use crystal camera state above the quaternion pose

The visible camera should still be applied to Three.js as a quaternion, because that is what the current preview, gizmo, lighting, and export snapshot already understand. The new controls introduce a higher-level camera state:

- Primary Axis: `Upward` or `Outward`;
- primary direct-lattice coefficients `[u v w]`;
- secondary reciprocal-lattice coefficients `[h k l]`;
- roll angle derived from the Primary Axis and VESTA-like anchor.

This gives the UI stable crystal-language controls without forcing the rest of the renderer to abandon the existing quaternion boundary.

### Keep semantic rows fixed and swap basis labels

The precise editor always shows two semantic rows in fixed order: `Outward` then `Upward`. Switching `Primary Axis` does not move rows; it changes which row is visually highlighted and which row uses direct versus reciprocal basis labels:

- `Upward` primary: `Upward = u a + v b + w c`, `Outward = h a* + k b* + l c*`.
- `Outward` primary: `Outward = u a + v b + w c`, `Upward = h a* + k b* + l c*`.

This keeps the semantic locations stable while still making the basis change explicit.

### Use VESTA-like roll anchoring

Roll must be reproducible rather than anchored to whichever camera pose happened to exist before a command. For a primary direct vector `P`, `Roll = 0°` uses the first usable reciprocal candidate from `c*`, then `b*`, then `a*`, projected onto the plane perpendicular to `P`.

This reproduces the useful VESTA-like behavior:

- primary `a` uses `c*` as the secondary direction;
- primary `b` uses `c*` as the secondary direction;
- primary `c` falls back to `b*`.

Dragging Roll rotates the secondary reciprocal direction around the primary direct axis. Manually applying a secondary vector should update the nearest equivalent roll angle.

### Batch precise vector input

The fixed `Manual` section is an advanced editor, not a live six-field form. The fields may reflect the current pose when the user is not editing. Once a user edits a field, values are treated as a draft; `Apply` or Enter commits all six coefficients together, and reset restores the draft from the current camera state.

This avoids camera jumps while typing values such as negative numbers or multi-field directions.

### Make the gizmo clickable without tooltips

The orientation gizmo should become an obvious control through hover highlighting and pointer cursor. A single click on `a`, `b`, or `c` applies that direct axis to the current Primary Axis. The gizmo should not show tooltips and should not keep an axis permanently highlighted; the Camera tab explains the current Primary Axis.

### Fallback silently for degenerate vectors

If a selected secondary direction is too parallel to the primary direction, the camera math should try the next VESTA-like fallback and then a stable final fallback. The UI should not show error popups for these cases. Input validation should prevent non-finite numbers from becoming camera state, but geometric near-degeneracy should be resolved quietly.

## Risks / Trade-offs

- Crystal camera state can drift from the live Three.js camera after free drag -> Convert from the live quaternion back into direct/reciprocal coefficients when the camera changes, with normalized display coefficients and integer snapping for near-simple directions.
- Roll and manual secondary vector edits can become confusing if they fight each other -> Treat Roll as the compact editor for the secondary direction, and after vector `Apply`, recompute Roll from the applied secondary direction.
- Non-orthogonal or triclinic cells can make direct/reciprocal differences visually surprising -> Keep the basis labels explicit (`a`, `b`, `c` versus `a*`, `b*`, `c*`) and use Gram-Schmidt projection internally.
- More controls can crowd the compact left panel -> Keep Manual compact, keep row order stable, and avoid extra status summaries or explanatory text in the panel.
