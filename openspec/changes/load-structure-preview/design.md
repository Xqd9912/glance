## Context

Pretty Lattice is now shaped as a local web GUI launched by `prl gui`. The
current app has a Python server, a React/Three.js shell, and a demo scene, but
the preview is still placeholder data. This change replaces that placeholder
path with a real structure-file preview while keeping the first GUI slice small.

The archived 2D project contains useful local assets: fixed structure fixtures,
VESTA-derived element radii, and a separated colormap registry. Those assets are
valuable, but the archived renderer and public config surface belong to a
different product shape. This change uses the assets without importing the old
2D workflow.

## Goals / Non-Goals

**Goals:**

- Let the desktop GUI open a local structure file and preview it.
- Support CIF and POSCAR-style files as the committed MVP formats.
- Convert ASE structures into a small frontend scene contract with atoms and
  unit-cell vectors.
- Resolve atom radius and color on the Python side using internal defaults.
- Follow the frontend design direction: a full scene workspace with one left
  floating interaction card, restrained black/white/gray UI, and no decorative
  color.
- Reuse only necessary archived assets: fixtures, element radii, and one default
  colormap preset.

**Non-Goals:**

- No user-facing visual controls for view, size, radius, color, background, or
  lighting.
- No PNG export in this slice.
- No automatic bonds, labels, measurement tools, symmetry conversion, supercell
  generation, saved recent files, or mobile layout work.

## Decisions

### Use browser upload into the local API

The GUI will open files through a browser file input and submit the selected
file to a local API endpoint. The server parses the uploaded bytes with ASE and
returns a scene response.

Alternative considered: add `prl gui path/to/file` or ask the server to read a
local path. That can be useful later, but it complicates the first GUI flow and
does not match the browser-first product interaction as well as a file picker.

### Keep the scene contract small and backend-owned

The scene response will contain the unit-cell vectors and atom records with
stable IDs, element symbols, Cartesian positions, resolved radii, and resolved
colors. The response will not include bonds, labels, visual-control settings, or
renderer-specific objects.

Resolving radius and color on the Python side keeps the frontend simple: the
browser receives values it can draw directly in Three.js. It also avoids
duplicating chemistry-style lookup tables in TypeScript.

### Borrow assets, not the archived product shape

Fixture structures can be copied into the new test tree because they are small,
fixed, and documented as pipeline fixtures rather than examples. The VESTA-based
element radius table and `vesta` colormap can also be copied as bundled internal
data.

The archived Skia renderer, camera/config surface, and broader ColorAide wrapper
will not be copied for this change. The MVP only needs hex colors at the
frontend boundary. The project can introduce a fuller color abstraction later
when the Pretty Lattice visual system is being designed.

### Separate element data from colormap data

Element size data and visual color data will stay in separate bundled
registries. The element registry provides radii, and the colormap registry
provides colors. The internal default colormap can be VESTA-compatible for now,
but that does not make VESTA colors the final Pretty Lattice palette.

The scene builder will use `atomic_radius` for the first preview. Other radius
columns can remain in bundled data as compatibility references, but they are not
user-facing controls in this slice.

### Use one left floating card over a full scene

The canvas remains the main workspace. All implemented interaction lives in one
left floating card: project title, open-file action, selected file name, loading
or parse status, parse error, and a compact structure summary when available.

Unimplemented actions are omitted. In particular, this change removes disabled
or placeholder controls such as export, visual presets, and bond counters until
those capabilities exist.

## Risks / Trade-offs

- ASE accepts many formats beyond CIF and POSCAR -> Commit tests and user-facing
  behavior only for the MVP formats; treat other formats as incidental.
- VESTA colors may not match the final Pretty Lattice look -> Label them as an
  internal compatibility baseline and keep colormap choice out of the UI.
- A tiny scene contract may need extension later -> Keep the initial contract
  explicit and additive so later bonds, labels, or export metadata can be added
  without changing the MVP fields.
- Browser uploads keep files in memory for parsing -> Use small MVP fixtures and
  clear error responses; file-size policy can be added when real usage demands
  it.
