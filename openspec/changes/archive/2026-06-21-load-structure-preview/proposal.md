## Why

Pretty Lattice now has the local server, web app shell, and demo scene wiring in
place, but the GUI still previews placeholder data. The next useful MVP slice is
to let a real structure file enter the local GUI and appear as a trustworthy
crystal preview without introducing early visual-control debt.

## What Changes

- Add a desktop GUI flow for opening a local structure file through the browser.
- Parse uploaded ASE-readable structure files through the Python API, with CIF
  and POSCAR fixtures as the committed baseline.
- Convert parsed structures into a stable scene specification for the frontend.
- Render the returned scene in the browser as atoms plus the unit cell, using
  fixed internal defaults.
- Replace demo-only frontend behavior with file name, loading, success, and
  parse-error states inside a single left floating interaction card.
- Reuse only necessary assets from the archived 2D project: fixed structure
  fixtures, bundled element radius data, and the internal VESTA colormap preset.

## Capabilities

### New Capabilities

- `structure-preview`: Local GUI structure loading, Python scene conversion,
  fixed-default atom and unit-cell preview, and minimal desktop interaction
  states.

### Modified Capabilities

- None.

## Impact

- Python API: new upload/parse endpoint and scene conversion from ASE `Atoms`.
- Python data: bundled element radii and internal default colormap data.
- Frontend: file-open card state, API call for uploaded structures, and Three.js
  rendering from returned scene data.
- Tests: copied fixture structures, parser/scene API tests, a non-whitelisted
  ASE-format smoke test, frontend type/build checks, and no committed generated
  preview images.
