# Backend Architecture Scan

Date: 2026-06-27

Scope: pre-refactor architecture scan of the Python backend. This note focuses on module boundaries, naming, coupling, and maintainability. It intentionally does not change backend code, run services, or use browser/Playwright validation.

## Short Answer

The backend is small, green, and behaviorally well protected, but its main structural risk is that `src/pretty_lattice/structures/scene.py` has become the backend's catch-all module. It currently owns the public scene JSON contract, periodic image expansion, bond algorithm selection, neighbor-table construction, polyhedra generation, visibility dependency algebra, summary/symmetry formatting, and analysis warning translation.

That is not yet a crisis because the total backend is still compact and tests are strong. But it is the most important pre-refactor smell: future bond, polyhedra, symmetry, or scene-contract work will keep colliding in one file unless the module boundary starts to match the domain boundary.

## 1. Biggest Structural Problem

`scene.py` mixes several concepts that change for different reasons:

- Scene contract: `CellSpec`, `AtomSpec`, `BondSpec`, `PolyhedronSpec`, `SceneSpec`, and warning types live near the top of the file.
- Scene orchestration: `build_scene_response()` chooses the bond algorithm, constructs atom records, runs connectivity, builds bonds/polyhedra, builds summary data, and catches analysis failures.
- Periodic rendering geometry: canonical fractional positions, boundary images, bonded images, atom IDs, Cartesian conversion, and visibility dependencies are all local helpers.
- Materials analysis: CrystalNN, MinimumDistanceNN, VESTA-style cutoffs, neighbor tables, and polyhedron center rules are implemented in the same module as serialization.
- Summary and symmetry: formula/cell formatting and `SpacegroupAnalyzer` handling are in the same module as bond/polyhedra code.

This makes the real boundary harder to see. The project wants "Python owns structure IO, materials analysis, and scene generation", but inside Python those are still folded into one file. The risk is not current incorrectness; it is that every future backend feature has to share one mental workspace.

## 2. Highest-Priority Refactor Targets

1. `src/pretty_lattice/structures/scene.py`
   This is the first and central target. It is 941 lines while the rest of the backend modules are small. Splitting it would immediately make future backend work easier to localize.

2. Scene contract ownership
   The Python `TypedDict` contract in `scene.py` and the TypeScript mirror in `web/src/api/scene.ts` are manually duplicated. That is acceptable for now, but it is a drift risk if the payload starts changing more often. A later step could generate one side from the other or at least isolate the Python contract in a dedicated module.

3. Bond algorithm boundary
   `BondAlgorithm`, labels, normalization, default choice, VESTA analyzer creation, and API query handling are spread between `scene.py`, `server/routes.py`, and `web/src/api/scene.ts`. The current behavior is fine, but the ownership is blurry: part API contract, part analysis strategy, part UI option list.

4. `tests/test_structures.py`
   The tests are valuable, but they now cover IO, dependency policy, contract shape, periodic images, algorithms, polyhedra, warnings, and symmetry in one file. During a backend refactor, split only if it helps keep intent visible: contract tests, periodic-image tests, connectivity tests, polyhedra tests, and summary/symmetry tests.

Lower priority: `readers.py`, `symmetry.py`, `server/app.py`, `server/routes.py`, and `cli.py` are currently small and understandable. They may need import updates during a refactor, but they are not the structural source of pain.

## 3. Suggested Backend Layers

Current effective flow:

```text
FastAPI route
-> read uploaded bytes into pymatgen Structure
-> build_scene_response()
-> one large private helper graph
-> project-owned scene JSON
```

Suggested internal shape:

```text
server/
  routes.py              HTTP details, upload size, query parsing, HTTP errors

structures/
  readers.py             file/bytes -> pymatgen Structure
  schema.py              project-owned scene payload types and public enums
  scene_builder.py       orchestration only: Structure -> SceneSpec
  periodic_images.py     canonical atom instances, image offsets, coordinates
  connectivity.py        bond algorithms, neighbor analyzers, connectivity result
  polyhedra.py           polyhedron selection and hull faces
  summary.py             formula, cell, symmetry summary
  visibility.py          dependency group algebra for boundary/one-hop visibility
  symmetry.py            Schoenflies mapping and related symmetry helpers
```

The important split is not "many files for neatness". It is separating stable contract shape from algorithmic analysis and from UI-facing visibility semantics.

## 4. Naming and Concept Boundary Issues

- `build_scene_response()` sounds HTTP-oriented, but it is a domain builder. A later rename to `build_scene_spec()` or `build_scene()` would make the route/domain boundary clearer.
- `scene.py` is too broad as a module name for code that performs bond and polyhedra analysis. It can remain as a compatibility facade during refactor, but not as the long-term owner of all scene internals.
- `_SiteRenderData` uses "render" even though the backend scene payload intentionally excludes renderer-owned visual data such as color and radius. A name like `_SiteSceneData` or `_SceneSite` would better match the current backend/frontend boundary.
- `VisibilityDependency` is a useful contract primitive, but it is also UI-shaped: `boundaryAtoms` and `oneHopBondedAtoms` correspond to frontend display toggles. That is acceptable because the backend owns which generated atoms/bonds/polyhedra depend on those toggles, but the concept should be isolated and documented so it does not quietly grow into general UI state.
- `_build_bonds()` currently returns `connectivity.bonds` without adding behavior. That is harmless, but it suggests the module has grown by accretion and would benefit from clearer phases.
- Error/warning construction is duplicated around bond and polyhedra analysis. This is a small smell, not an urgent bug.

## 5. Areas Not Worth Touching First

- Do not start by changing the public scene JSON shape. Tests explicitly protect that the payload contains geometry/analysis data and excludes renderer visual data like color and radius.
- Do not move visual presentation tables back into Python. Current project direction keeps colormaps and display radii frontend-owned.
- Do not change the accepted pymatgen backend foundation. The decision is documented and the tests already guard against direct ASE/spglib project imports.
- Do not rewrite VESTA cutoff behavior, polyhedron center semantics, or periodic image semantics during a structural refactor. These are behaviorally sensitive and should move first, not change first.
- Do not begin with CLI/static-web mounting cleanup. `cli.py` and `server/app.py` are not the backend architecture bottleneck.
- Do not over-abstract into a service framework. The backend is still small; a simple module split is enough.

## 6. Recommended One-Shot Refactor Plan

Do one coordinated backend refactor that changes module boundaries without changing behavior.

### Target Shape After the Pass

- `scene.py` becomes either a thin compatibility facade or disappears in favor of `scene_builder.py` plus focused helper modules.
- Public payload types and algorithm enums live in one contract module.
- Periodic image expansion, connectivity, polyhedra, visibility algebra, and summary/symmetry each have one obvious home.
- `server/routes.py` remains thin: validate HTTP input, call the domain builder, translate project exceptions to HTTP errors.
- Frontend behavior and payload shape remain unchanged.

### Work Order

1. Freeze behavior with the current test suite.
   Keep the current tests green before moving code. Add no behavior changes unless a move exposes a missing import or dependency.

2. Extract the contract first.
   Move `TypedDict` scene payload types, `BondAlgorithm`, warning types, `DEFAULT_BOND_ALGORITHM`, labels, and `normalize_bond_algorithm()` into a small schema/contract module. Keep re-exports if needed to reduce churn.

3. Extract visibility algebra.
   Move dependency groups and ordering helpers into `visibility.py`. This is low-risk and clarifies the UI-facing part of the contract.

4. Extract periodic image and atom-record logic.
   Move `_SiteRenderData`, `_AtomRecord`, atom IDs, canonicalization, image offsets, and coordinate conversion into `periodic_images.py` or `atoms.py`.

5. Extract connectivity.
   Move `_ConnectivityResult`, `_ConnectedAtom`, `_BondRecord`, `_neighbor_analyzer_for_bond_algorithm()`, `_VestaCutOffDictNN`, and `_build_connectivity()` into `connectivity.py`.

6. Extract polyhedra.
   Move `_build_polyhedra()`, center selection, drawn-neighbor filtering, and Delaunay face generation into `polyhedra.py`.

7. Extract summary.
   Move `_build_structure_summary()`, `_build_symmetry_summary()`, formatting helpers, and valid-cell checks into `summary.py` while keeping `symmetry.py` as the Schoenflies lookup owner.

8. Slim the orchestrator.
   Leave `build_scene_spec()` responsible only for sequencing: prepare site data, call connectivity/polyhedra/summary, and assemble `SceneSpec`.

9. Keep frontend contract changes out of this pass.
   If the Python module split succeeds cleanly, a later contract-generation or schema-sync pass can address duplication with `web/src/api/scene.ts`.

### Verification

Run:

```bash
uv run ruff check .
uv run pytest -q -p no:cacheprovider
```

Current scan result:

- `uv run ruff check .`: passed.
- `uv run pytest -q -p no:cacheprovider`: 58 passed, 57 warnings.
- Warnings were from spglib deprecations and pymatgen CIF rounding notices; no backend test failures.

No browser or Playwright validation was used.

## Files Reviewed

Key files reviewed:

- `docs/index.md`
- `docs/development.md`
- `docs/constitution.md`
- `docs/decisions/use-pymatgen-backend.md`
- `docs/decisions/keep-camera-interaction-in-threejs.md`
- `src/pretty_lattice/cli.py`
- `src/pretty_lattice/server/app.py`
- `src/pretty_lattice/server/routes.py`
- `src/pretty_lattice/structures/readers.py`
- `src/pretty_lattice/structures/scene.py`
- `src/pretty_lattice/structures/symmetry.py`
- `tests/test_api.py`
- `tests/test_cli.py`
- `tests/test_structures.py`
- `web/src/api/scene.ts`
- `web/src/model/displayState.ts`
- selected `web/src/app/App.tsx` call sites for scene upload and bond algorithm changes
