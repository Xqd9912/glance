## Context

The current GUI can load a structure, render it in a full-window Three.js
preview, and adjust visibility, opacity, style, zoom, and rotation. The left
common-controls panel already includes an `Export` tab, but that tab is still a
reserved page.

This change adds the first real export path. The goal is to turn the current
loaded view into a high-quality raster figure while keeping export composition
small: no legend export, no orientation gizmo export, and no full camera-system
redesign in this slice.

## Goals / Non-Goals

**Goals:**

- Add a usable `Export` tab with output size, aspect-ratio lock,
  supersampling, mesh detail, format selection, and one export action.
- Export the visible structure scene as PNG.
- Export the same raster image embedded in a PDF page, with the unit-cell
  boundary drawn as a vector PDF overlay when it is visible.
- Keep output format as a setting so later formats can reuse the same render
  path.
- Introduce a narrow camera-pose snapshot boundary so export can reuse the
  current preview orientation without inheriting preview window size.
- Split export quality into 2D output controls and 3D mesh-detail presets.

**Non-Goals:**

- Exporting or composing the element legend.
- Exporting or composing the orientation gizmo.
- Building saved camera presets, view-direction input, or a complete Camera
  tab workflow.
- Producing full vector PDF geometry from the Three.js scene beyond the first
  unit-cell boundary overlay.

## Decisions

### Export is one action with format as a setting

The `Export` tab will expose `PNG | PDF` as a small segmented format control
and a single primary action. The action label follows the selected format, such
as `Export PNG` or `Export PDF`.

This avoids two competing action buttons while keeping the first UI light. If
more formats arrive later, the internal setting can stay as `format`, while the
UI can change from a segmented control to a select menu.

### PDF means raster main image plus a narrow vector overlay

The PDF path will render the same high-quality raster image used for PNG and
place it into a PDF page matching the export frame. In addition, when the unit
cell is visible, the PDF path will project the unit-cell boundary into the same
export frame and draw the twelve boundary segments as PDF vector lines. This
keeps the immediate publication workflow useful without requiring the much
harder problem of translating a lit WebGL scene into vector PDF primitives.

The export pipeline should therefore be:

1. resolve export settings;
2. compute the current projected export frame from visible scene elements;
3. render a raster image at the requested quality;
4. encode the raster image as PNG or place it into PDF;
5. add supported PDF vector overlays, starting with the unit-cell boundary.

### Keep 2D output quality separate from 3D mesh detail

2D output controls describe the final image plane:

- width;
- height;
- aspect-ratio lock;
- supersampling factor.

3D detail describes the scene before it is rasterized. The first version uses
four presets: `Low`, `Medium`, `High`, and `XHigh`. These presets control atom
sphere and bond cylinder detail together. The user does not need separate atom
and bond mesh controls.

Renderer correctness choices such as line export strategy, transparent
polyhedra ordering, depth write behavior, and render order remain internal
implementation details. Users should not need to understand renderer failure
modes to export a normal figure.

### Export frame is independent from the preview viewport

Preview fills the browser window and avoids overlay safe areas. Export uses a
separate frame with explicit width and height. When aspect lock is enabled,
editing one dimension updates the other using the projected tight-box aspect
ratio for the current orientation and visible scene elements.

The aspect ratio should come from the fitted export framing for the current
view rather than from the browser window. The tight box must be based on the
elements that will be exported: atoms only when atom spheres are visible, bonds
only when bonds are visible, polyhedra only when polyhedra are visible, and the
unit-cell frame only when the unit cell is visible. Periodic-image controls such
as boundary atoms and one-hop bonded atoms affect the tight box through the
visible scene. If the user unlocks the ratio, the same structure view is fitted
into the arbitrary frame, possibly leaving more horizontal or vertical
whitespace.

### Add a narrow camera-pose snapshot

Export should use the current preview orientation, but it should not depend on
the interactive controls owning hidden state. Add a small camera-pose snapshot
that can be derived from the live Three.js camera. The first version only needs
the data required to reproduce orientation and centered orthographic framing,
such as projection kind, target, and orientation.

Preview zoom does not automatically define export size. Export fitting is based
on the projected tight box, export frame, and export padding. A future option
can explicitly match preview zoom if that becomes useful.

### Share scene rendering without sharing preview interaction

The current `LatticeScene` component mixes the canvas, scene content, lighting,
camera setup, and interactive controls. Export should reuse the scene-content
and camera math, but not Trackball/Orbit controls or preview wheel handlers.

The implementation should introduce a thin reusable scene-rendering boundary
that both preview and export can call. This is not a large rewrite; it is a
small separation between "draw this scene" and "let the user interact with the
preview canvas."

### Legend and gizmo stay future-aware

The element legend is currently a DOM overlay, and the orientation gizmo is a
separate small Three.js canvas. Neither should be silently included in the first
export. The export design should keep a place for future exported overlays or
separate overlay assets, but the first slice exports only the main structure
figure.

## Risks / Trade-offs

- Browser canvas memory can grow quickly with large size and high
  supersampling -> Clamp dimensions and supersampling to bounded first-version
  values and show a recoverable export error if rendering fails.
- PDF output could be mistaken for full vector PDF -> Keep the implementation
  and tests explicit that PDF embeds a raster image plus only supported vector
  overlays, starting with the unit-cell boundary.
- Camera-pose export can drift from preview controls -> Capture pose from the
  live camera at export time and keep export target centered for the loaded
  scene.
- Reusing preview components directly could carry interaction behavior into
  export -> Split reusable scene content from preview-only controls before
  wiring export.
- Legend/gizmo omission could surprise users -> Keep first-version export
  focused on the structure figure and leave future overlay export as an
  explicit follow-up.
