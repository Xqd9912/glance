## 1. Backend Polyhedra Data

- [ ] 1.1 Refactor scene-building internals so bond records and polyhedron records share one selected-neighbor connectivity pass.
- [ ] 1.2 Add backend scene contract support for polyhedron records with center atom ID, hull atom IDs, face indices, color, opacity, and visibility metadata.
- [ ] 1.3 Implement Crystal Toolkit-compatible center eligibility: more than three drawn connected atoms, no missing connected atoms, and lower pymatgen species ordering than every connected neighbor.
- [ ] 1.4 Generate hull faces from the center-plus-connected-atom position set and skip degenerate individual centers without returning invalid geometry.
- [ ] 1.5 Return non-fatal analysis warnings for scene-level polyhedra generation failures while preserving available atom, cell, and bond data.

## 2. Backend Tests

- [ ] 2.1 Add fixture-backed tests that generate polyhedra for a representative complete coordination environment.
- [ ] 2.2 Add tests that suppress reverse centers and same-species centers according to the Crystal Toolkit-compatible electronegativity rule.
- [ ] 2.3 Add tests that prove polyhedra follow the selected bond algorithm and do not use a separate hard-coded connectivity source.
- [ ] 2.4 Add tests for empty polyhedra results, skipped degenerate centers, and non-fatal polyhedra warning responses.

## 3. Frontend Scene State And Rendering

- [ ] 3.1 Extend frontend scene types and visible-scene filtering for polyhedron records and their hull atom dependencies.
- [ ] 3.2 Render polyhedra as translucent surfaces with edge outlines from returned hull atom IDs and face indices.
- [ ] 3.3 Enable the `Polyhedra` display checkbox when scene data includes polyhedra, keep it disabled when absent, and preserve independent component visibility behavior.
- [ ] 3.4 Preserve local visibility state when bond algorithm changes regenerate both bonds and polyhedra from the selected algorithm.

## 4. Frontend Tests And Validation

- [ ] 4.1 Add unit tests for polyhedra filtering when boundary or one-hop image atoms are hidden.
- [ ] 4.2 Add render/state tests for toggling Polyhedra independently from Atoms, Bonds, and Unit cell.
- [ ] 4.3 Add frontend tests covering enabled and disabled Polyhedra display-row states.
- [ ] 4.4 Run backend tests, frontend tests, typecheck/build, OpenSpec validation, and a focused preview visual check for polyhedra rendering.
