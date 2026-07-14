# Ring Statistics: Native Shortest-Path Rings

## Status

Accepted.

## Context

The structure-analysis module needs ring statistics — the count of primitive
rings of each size (3-, 4-, 5-membered, …) per frame — for network and
phase-change materials such as Ge-Sb-Te.

Two reference implementations were provided (`develop_map/reference_src/`):

- **OVITO `RingFinder`** (`ovito-rings.ipynb`): drives OVITO's pipeline with a
  compiled C++ `RingFinder` extension. Accurate, but pulls in the full OVITO
  runtime plus a platform-specific native extension.
- **`julia_rings`** (`julia-rings.ipynb`): computes primitive rings through a
  Julia package called over PyCall, on top of ASE. Scales well to large
  systems, but requires a Julia toolchain and the PyCall bridge at runtime.

Both are heavyweight for a pip-installable, cross-platform local web app, and
neither reuses the per-element bond cutoffs the rest of `glance.analysis`
already derives from g(r).

## Decision

Reimplement ring statistics natively in `src/glance/analysis/rings.py` using
pure NumPy and the standard library, on top of pymatgen's periodic neighbour
search. No OVITO, no Julia, no new runtime dependency.

We count **primitive (shortest-path / King–Franzblau SP) rings**: a simple
cycle of atoms is a ring iff, for every pair of ring atoms, the shorter arc
along the ring is a topological shortest path in the full bond graph (an
*isometric* cycle). This is the same criterion both references compute, and it
is the standard reported for amorphous and phase-change networks.

Periodicity is exact: every bond carries the lattice-image offset of its
endpoint, and a closed walk is only counted when the offsets sum to zero, so
walks that merely wrap through periodic images are rejected. The search fixes
each ring's minimum-index atom as a canonical root and prunes partial paths by
their shortest-path distance back to that root, which keeps the low-coordination
networks these systems produce tractable (216-atom GST frame ≈ 20 ms).

## Consequences

- Ring statistics ship with the package and reuse the existing cutoff matrix
  (`cutoff_matrix_from_pairs`) and frame-range plumbing; the endpoint mirrors
  the descriptors endpoint (`POST /api/trajectory/{id}/analysis/rings`).
- Two data products are returned, matching the visualization plan: the
  frame-averaged size distribution (mean ± std, drawn as a bar chart) and the
  per-frame counts (drawn as a box plot).
- The isometric definition can report a large ring that co-exists with smaller
  rings when the large ring has no internal shortcut (e.g. a cube has 6 square
  faces *and* 4 chordless hexagons). This is correct for the SP-ring definition
  and is asserted in `tests/test_rings.py`.
- Ring finding assumes rings do not revisit the same atom index, which holds for
  the multi-hundred-atom MD cells this targets. A ring definition that treats
  each (atom, image) as a distinct node would be needed only for very small
  primitive cells; not implemented.
- Chemical-ordering (ABAB) ring classification from the Julia reference is not
  ported; it can be layered on later since the ring member indices are already
  available inside the kernel.
