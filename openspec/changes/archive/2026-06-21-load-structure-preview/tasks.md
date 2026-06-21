## 1. Assets And Data

- [x] 1.1 Copy only the selected archived structure fixtures and source notes needed for CIF/POSCAR parser and scene tests.
- [x] 1.2 Add bundled element radius data and a separate bundled `vesta` colormap preset as internal data assets.
- [x] 1.3 Add focused loaders for element radius and colormap data, keeping color data separate from element records.

## 2. Structure Parsing And Scene API

- [x] 2.1 Harden structure reading so parse failures return clear project-level errors.
- [x] 2.2 Build a scene conversion path from ASE structures to the MVP scene contract: cell vectors plus atoms with ID, element, position, radius, and color.
- [x] 2.3 Add a local API upload endpoint that accepts structure files and returns either the scene response or a clear parse error.
- [x] 2.4 Retire demo-only API assumptions from the preview path without adding bonds, labels, saved files, or visual-control settings.

## 3. Frontend Preview

- [x] 3.1 Replace automatic demo loading with a left floating interaction card for opening a file and showing file/status/error information.
- [x] 3.2 Update the frontend API client and scene types to use uploaded structure previews and the MVP scene contract.
- [x] 3.3 Render returned atoms and the unit-cell frame in the full-workspace Three.js scene using fixed internal defaults.
- [x] 3.4 Remove disabled or placeholder controls for unimplemented actions such as export, visual presets, bonds, and styling controls.

## 4. Verification

- [x] 4.1 Add Python tests for fixture parsing, scene response shape, element radius resolution, colormap resolution, and upload API error handling.
- [x] 4.2 Add or update frontend checks for preview state handling and scene type compatibility.
- [x] 4.3 Run `uv run pytest`, `uv run ruff check .`, `cd web && bun run typecheck`, and `cd web && bun run build`.
- [x] 4.4 Verify the desktop GUI layout visually: full-scene workspace, one left floating card, no mobile-specific work, and no unimplemented controls shown.
