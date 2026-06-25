## Why

Pretty Lattice's workflow ends with a publication-ready figure, but the current
GUI only supports interactive preview. The next vertical slice should let the
user export the loaded view as a high-quality raster image without turning the
export tab into a full camera or layout system.

## What Changes

- Add implemented controls to the left `Export` tab for output size,
  aspect-ratio locking, supersampling, 3D mesh detail, and output format.
- Support PNG export and PDF export from the same export settings, with PDF
  using the raster main image plus a vector unit-cell boundary overlay.
- Keep output format as an explicit setting so later formats can reuse the same
  render pipeline.
- Capture the current preview orientation as an explicit camera-pose snapshot
  for export, while keeping export size and export fitting independent from the
  preview window and preview zoom.
- Fit exports to a projected tight box derived from the currently visible
  scene elements, so visibility choices such as one-hop bonded atoms affect the
  export aspect ratio.
- Add 3D mesh-detail presets `Low`, `Medium`, `High`, and `XHigh` that control
  atom and bond geometry detail together.
- Add 2D export controls for width, height, aspect-ratio lock, and
  supersampling factor.
- Leave element legend and orientation gizmo export out of the first slice, but
  keep the export architecture ready for those overlays to become separate or
  composited export assets later.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `structure-preview`: Adds first-class browser figure export from the loaded
  structure preview, including PNG, raster-backed PDF with vector unit-cell
  boundary overlay, export sizing, supersampling, mesh-detail presets, and a
  narrow camera-pose export boundary.

## Impact

- Frontend preview state and export settings under `web/src/app/`.
- Three.js scene rendering under `web/src/scene/`, especially separating
  reusable scene rendering from interactive preview controls.
- Frontend tests for export settings, camera-pose snapshot behavior, and export
  action routing.
- A lightweight browser-side PDF dependency may be added if needed for
  raster-in-PDF encoding.
- No Python API or backend scene-contract changes are expected.
