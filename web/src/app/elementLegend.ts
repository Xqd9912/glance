import type { SceneSpec } from "../api/scene";
import {
  type ElementColorOverrides,
  elementColorForScheme,
  type ColorScheme,
} from "./colorSchemes";

export interface ElementLegendEntry {
  color: string;
  element: string;
}

export function deriveElementLegendEntries(
  scene: SceneSpec | null,
  colorScheme: ColorScheme = "vesta-soft",
  colorOverrides?: ElementColorOverrides,
): ElementLegendEntry[] {
  if (!scene) {
    return [];
  }

  const entries: ElementLegendEntry[] = [];
  const seenElements = new Set<string>();
  for (const atom of scene.atoms) {
    if (atom.isPeriodicImage) {
      continue;
    }
    if (seenElements.has(atom.element)) {
      continue;
    }

    seenElements.add(atom.element);
    entries.push({
      color: elementColorForScheme(atom.element, colorScheme, colorOverrides),
      element: atom.element,
    });
  }

  return entries;
}
