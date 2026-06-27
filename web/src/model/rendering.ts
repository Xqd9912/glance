import type { SceneSpec } from "../api/scene";

export type AtomRenderingMode = "mesh" | "instanced";

export const DEFAULT_ATOM_RENDERING_MODE: AtomRenderingMode = "mesh";
export const INSTANCED_ATOM_DEFAULT_THRESHOLD = 1000;

export function defaultAtomRenderingModeForScene(
  scene: Pick<SceneSpec, "summary"> | null,
): AtomRenderingMode {
  if ((scene?.summary.atomCount ?? 0) >= INSTANCED_ATOM_DEFAULT_THRESHOLD) {
    return "instanced";
  }

  return DEFAULT_ATOM_RENDERING_MODE;
}
