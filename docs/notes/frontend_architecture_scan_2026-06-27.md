# Frontend Architecture Scan

Date: 2026-06-27

Scope: pre-refactor architecture scan of `web/src`. This note focuses on structure, module boundaries, and maintainability. It intentionally does not propose UI restyling and does not require browser or Playwright validation.

## Short Answer

The frontend is functionally coherent, but a few files have become architectural catch-alls. The biggest maintenance risk is not the current UI behavior; it is that important concepts are separated mostly by comments and function names inside very large files, rather than by module boundaries that match the product concepts.

The highest-value refactor is a medium-sized one-shot pass that reshapes the main frontend boundaries in one coordinated change: split the common controls panel by tab/domain, split the scene layer by renderer concern, and move shared presentation types out of `app/settings.ts`. The pass should still preserve the existing UI, scene behavior, backend contract, and tests.

## 1. Biggest Structural Problem

The main problem is concentration of responsibilities:

- `web/src/app/controls/CommonControlsPanel.tsx` is nearly 3000 lines and contains the tab shell, tab height animation, Orientation/Display/Style/Export tab contents, a small React Three Fiber axis chooser, export form controls, vector editing, reset-feedback animation state, percent sliders, opacity sliders, option swatches, parsing, formatting, and clamping helpers.
- `web/src/scene/LatticeScene.tsx` is over 2000 lines and contains canvas setup, camera controller behavior, camera animation, scene layout, atom/bond/polyhedron rendering, material application, highlight animation, geometry builders, export scene content, and safe-area logic.
- `web/src/app/App.tsx` is over 1000 lines and currently acts as the full application coordinator: scene loading, file upload, backend errors, WebGPU detection, camera freeze state, export flow, inspector state, selected atom state, panel wiring, and overlay layout.

This makes changes harder to localize. A small export-control edit requires reading camera and display helpers. A small scene rendering change risks touching camera control and export behavior. The code is still understandable, but the cost of re-entering it is rising.

## 2. Highest-Priority Refactor Targets

1. Split `CommonControlsPanel.tsx` first.
   Keep `CommonControlsPanel` as the composition boundary, but move tab contents into separate modules:
   - `commonPanel/DisplayTab.tsx`
   - `commonPanel/StyleTab.tsx`
   - `commonPanel/ExportTab.tsx`
   - `commonPanel/OrientationTab.tsx`
   - `commonPanel/sharedControls.tsx`
   - `commonPanel/controlFeedback.ts`

2. Extract shared control primitives from the panel.
   `PercentSliderRow`, opacity/value input behavior, timed reset feedback, option-token labels, and auto-blur slider behavior are reusable UI mechanics. They should not belong to any one tab.

3. Split `LatticeScene.tsx` after the panel split.
   Suggested direction:
   - `scene/LatticeScene.tsx`: public preview component and scene composition only.
   - `scene/PreviewCameraController.tsx`: controls, zoom sync, interaction lock, camera command animation.
   - `scene/StructureSceneObjects.tsx`: atom/bond/polyhedron/cell frame composition.
   - `scene/structureGeometry.ts`: two-tone bond and polyhedron geometry builders.
   - `scene/sceneLayout.ts`: layout and safe-area fitting.
   - `scene/ExportSceneContent.tsx`: export-only scene content.

4. Move neutral types out of upward dependencies.
   `scene` currently imports app concepts such as `StyleState`, `RenderBackend`, `InteractionMode`, `ComponentOpacityState`, and color/radius lookup helpers. That couples the renderer to the app layer. A small neutral model layer would make the direction cleaner.

## 3. Suggested Frontend Layers

Suggested long-term shape:

- `api/`: backend payload contract and fetch functions. Keep this stable and boring.
- `data/`: bundled visual lookup data such as colormaps, radii, and material presets.
- `model/` or `render-model/`: neutral presentation types used by both app and scene, such as appearance, visibility, opacity, export settings, render backend, safe areas, and camera interaction mode.
- `app/`: orchestration, upload/export workflows, app-level state hooks, and overlay composition.
- `app/controls/`: user-facing control surfaces. Each large surface can have its own folder.
- `scene/`: Three.js/R3F rendering, camera controller, geometry, layout, and export rendering.
- `components/ui/`: shadcn/ui primitives and low-level UI elements.

The important rule is dependency direction:

`api/data/model -> app` and `api/data/model -> scene`, while `scene` should avoid importing `app`.

## 4. Naming and Concept Boundary Issues

- `settings.ts` is doing too many jobs. It holds display visibility, opacity, style, export settings, render backend options, inspector safe area, scene filtering, and export validation. The name is too broad, and the file has become a catch-all for "state-like things".
- `StyleState` mixes color scheme, material preset, fog, atom radius scale, bond thickness, atom radius model, and bond color mode. These are all visual appearance controls, but "style" may be too generic. `StructureAppearanceState` or `RenderAppearanceState` would make the boundary clearer.
- Display versus Style is a reasonable UI distinction, but the model layer should be clearer: Display currently means visibility/opacity/periodic images, while Style means appearance/material/geometry scale/fog/color. That user-facing split can remain, but the underlying modules should name the distinction explicitly.
- `RenderBackend` lives in app settings while `renderBackend.ts` lives in scene. The naming suggests the scene owns backend details, so the type/options probably belong in a neutral render model or scene-facing module.
- `PreviewSafeArea` is exported from `LatticeScene.tsx`, while inspector safe-area constants live in `settings.ts`. This creates an unnecessary app-to-scene type dependency.
- `CommonControlsPanel` is accurate historically, but as the panel grows, a folder-level boundary such as `commonPanel/` or a more domain-specific name would communicate ownership better.

## 5. Areas Not Worth Touching First

- Do not start by changing `api/scene.ts` or the backend scene contract. It is a clear boundary and many tests depend on it.
- Do not move frontend-owned visual data such as colormaps and element radii back toward the backend.
- Do not refactor shadcn/ui primitives. They are low-level and stable enough.
- Do not rewrite camera math, export frame math, or crystal orientation behavior as a first slice. Those pieces are behaviorally sensitive and already have targeted tests.
- Do not begin with `App.tsx` state extraction. It is large, but it is also the integration point; pulling it apart before the leaf modules are cleaner would raise risk.
- Do not change visual defaults, labels, or interaction behavior during the structural refactor unless the change is deliberately scoped and tested.

## 6. Recommended One-Shot Refactor Plan

Do one coordinated refactor rather than a tiny first slice. The target is to make the frontend feel clean after one pass, while avoiding behavior rewrites.

### Target Shape After the Pass

- `CommonControlsPanel.tsx` becomes a shell: tab list, tab state, tab animation, and wiring only.
- Each common-panel tab lives in its own file and owns its own local UI helpers.
- Shared tiny control helpers live under the common-panel folder instead of in one giant panel file.
- `LatticeScene.tsx` becomes the public preview component and scene composition boundary, not the home for all renderer internals.
- Scene layout, structure objects, camera controller, and export scene content become separate scene modules.
- Neutral presentation types are no longer defined only in `app/settings.ts`.

### Proposed File Layout

Create:

- `web/src/app/controls/commonPanel/CommonControlsPanel.tsx`
- `web/src/app/controls/commonPanel/DisplayTab.tsx`
- `web/src/app/controls/commonPanel/StyleTab.tsx`
- `web/src/app/controls/commonPanel/ExportTab.tsx`
- `web/src/app/controls/commonPanel/OrientationTab.tsx`
- `web/src/app/controls/commonPanel/sharedControls.tsx`
- `web/src/app/controls/commonPanel/controlFeedback.ts`
- `web/src/model/appearance.ts`
- `web/src/model/exportSettings.ts`
- `web/src/model/displayState.ts`
- `web/src/model/renderBackend.ts`
- `web/src/model/layout.ts`
- `web/src/model/colorSchemes.ts`
- `web/src/model/elementRadii.ts`
- `web/src/model/materialPresets.ts`
- `web/src/model/viewState.ts`
- `web/src/model/cameraInteractionStore.ts`
- `web/src/scene/PreviewCameraController.tsx`
- `web/src/scene/StructureSceneObjects.tsx`
- `web/src/scene/StructureMaterial.tsx`
- `web/src/scene/structureGeometry.ts`
- `web/src/scene/sceneLayout.ts`
- `web/src/scene/ExportSceneContent.tsx`

Keep compatibility shims during the pass if useful. For example, `app/settings.ts` can temporarily re-export the new model functions/types so call sites can be moved in a controlled way.

### Work Order

1. Establish the new model boundary.
   Move pure state/types/helpers out of `app/settings.ts`:
   - display visibility and opacity to `model/displayState.ts`
   - style/appearance state to `model/appearance.ts`
   - export settings and validation to `model/exportSettings.ts`
   - render backend options to `model/renderBackend.ts`
   - safe-area/layout constants to `model/layout.ts`

2. Split the common controls panel.
   Move all four tabs in one pass so the panel does not remain half-clean. Keep `CommonControlsPanel`'s external props unchanged at first. Put shared slider rows, option token labels, and feedback hooks in the common-panel folder.

3. Split the scene layer.
   Move without changing behavior:
   - camera controls and camera command animation to `PreviewCameraController.tsx`
   - atom/bond/polyhedron/cell-frame composition to `StructureSceneObjects.tsx`
   - material component to `StructureMaterial.tsx`
   - geometry builders to `structureGeometry.ts`
   - layout and safe-area functions to `sceneLayout.ts`
   - export-only content to `ExportSceneContent.tsx`

4. Fix import direction.
   After the moves, make `scene` import from `api`, `data`, `model`, and sibling `scene` modules. Avoid imports from `app`. This is the main architectural payoff.

5. Keep `App.tsx` mostly intact.
   Update imports and maybe group small handler blocks, but do not extract a full app-state reducer in this pass. The one-shot refactor should clean the heavy leaf modules first.

### What Not To Include

- Do not rename UI labels or change defaults.
- Do not rewrite camera math, orbit/trackball behavior, export frame math, or atom inspection behavior.
- Do not change the backend scene payload.
- Do not introduce global state libraries.
- Do not redesign CSS or visual hierarchy.
- Do not make the folder split so granular that every small component becomes its own file.

### Verification

Run from `web/`:

```bash
bun test
bun run typecheck
bun run build
```

If the pass touches only imports and module boundaries, this should be enough. Browser or Playwright testing should remain opt-in unless a behavior change accidentally appears.

### Expected Result

After this one-shot pass, future work should usually land in one obvious place:

- new common-panel control: a tab file or `sharedControls.tsx`
- new visual appearance setting: `model/appearance.ts`, a tab file, and scene rendering use
- new display visibility behavior: `model/displayState.ts` plus Display tab
- new export setting: `model/exportSettings.ts`, Export tab, and export renderer path
- new rendered object type: `StructureSceneObjects.tsx` plus focused geometry/material helpers
