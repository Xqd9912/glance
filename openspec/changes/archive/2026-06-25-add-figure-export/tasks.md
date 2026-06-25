## 1. Export Settings And UI

- [x] 1.1 Add frontend export settings state for width, height, aspect-ratio lock, supersampling, mesh detail, and output format.
- [x] 1.2 Implement locked and unlocked size editing so either dimension can drive the other when the lock is enabled.
- [x] 1.3 Replace the reserved `Export` tab content with compact controls for size, supersampling, mesh detail, format, and a single primary export action.
- [x] 1.4 Keep format selection as a setting and update the export action label for PNG versus PDF.
- [x] 1.5 Add bounded validation for export dimensions and supersampling so invalid values do not trigger an export.

## 2. Shared Scene Export Pipeline

- [x] 2.1 Split the reusable scene-rendering content and camera math from preview-only interaction controls.
- [x] 2.2 Add a camera-pose snapshot boundary that captures the current preview orientation for export.
- [x] 2.3 Add mesh-detail presets that control atom and bond geometry detail together without changing the preview scene.
- [x] 2.4 Implement offscreen export rendering using the configured export frame, supersampling, mesh detail, visible scene, component opacity, and style state.
- [x] 2.5 Keep element legend and orientation gizmo out of the first exported PNG/PDF outputs while preserving the main structure figure.

## 3. Output Encoders

- [x] 3.1 Implement PNG encoding and download from the exported raster image.
- [x] 3.2 Add a lightweight raster-in-PDF encoder path and dependency if needed.
- [x] 3.3 Implement PDF download by placing the same exported raster image onto a PDF page matching the export frame.
- [x] 3.4 Surface recoverable export errors without losing the loaded scene or current export settings.

## 4. Tests And Validation

- [x] 4.1 Add unit tests for export settings reducers/helpers, including aspect lock behavior and format switching.
- [x] 4.2 Add tests for export UI controls and action-label updates in the `Export` tab.
- [x] 4.3 Add focused tests for camera-pose snapshot wiring and mesh-detail preset mapping where practical.
- [x] 4.4 Add tests or smoke coverage for PNG and raster-in-PDF export action routing without requiring golden image files.
- [x] 4.5 Run frontend tests, typecheck/build, and OpenSpec validation. Focused browser export checks are deferred to manual user QA.

## 5. Corrected Export Framing And PDF Vector Overlay

- [x] 5.1 Compute export aspect ratio and fitting from a projected tight box around the currently visible exported scene elements.
- [x] 5.2 Make periodic-image visibility, including one-hop bonded atoms, affect the projected export tight box.
- [x] 5.3 Use the projected tight box for offscreen export camera fitting instead of the full loaded scene span.
- [x] 5.4 Draw visible unit-cell boundary lines as PDF vector overlay geometry on top of the raster main image.
- [x] 5.5 Add focused tests for tight-box aspect ratio and unit-cell vector-line projection.
