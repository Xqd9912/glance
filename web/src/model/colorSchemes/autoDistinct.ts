import type { AtomSpec } from "../../api/scene";

import {
  hexToOklch,
  oklchDistance,
  oklchToInGamutHex,
  type OklchColor,
} from "./oklch";

export type ElementColorOverrides = Readonly<Record<string, string>>;

const SIMILAR_COLOR_DISTANCE_THRESHOLD = 0.11;
const LOCAL_HUE_DELTAS = [0, -12, 12, -24, 24, -32, 32] as const;
const LOCAL_LIGHTNESS_DELTAS = [0, -0.04, 0.04, -0.08, 0.08, -0.12, 0.12] as const;
const LOCAL_CHROMA_SCALES = [1, 0.9, 1.1, 0.75, 1.2] as const;
const STRONG_SEMANTIC_ELEMENTS = new Set(["O", "N", "C", "H"]);
const SECONDARY_SEMANTIC_ELEMENTS = new Set(["S", "P", "F", "Cl", "Br", "I"]);
const MATERIAL_ANCHOR_ELEMENTS = new Set([
  "B",
  "Si",
  "Ti",
  "V",
  "Cr",
  "Mn",
  "Fe",
  "Co",
  "Ni",
  "Cu",
  "Zn",
]);
const ELEMENT_ORDER = new Map(
  [
    "H",
    "He",
    "Li",
    "Be",
    "B",
    "C",
    "N",
    "O",
    "F",
    "Ne",
    "Na",
    "Mg",
    "Al",
    "Si",
    "P",
    "S",
    "Cl",
    "Ar",
    "K",
    "Ca",
    "Sc",
    "Ti",
    "V",
    "Cr",
    "Mn",
    "Fe",
    "Co",
    "Ni",
    "Cu",
    "Zn",
    "Ga",
    "Ge",
    "As",
    "Se",
    "Br",
    "Kr",
    "Rb",
    "Sr",
    "Y",
    "Zr",
    "Nb",
    "Mo",
    "Tc",
    "Ru",
    "Rh",
    "Pd",
    "Ag",
    "Cd",
    "In",
    "Sn",
    "Sb",
    "Te",
    "I",
    "Xe",
    "Cs",
    "Ba",
    "La",
    "Ce",
    "Pr",
    "Nd",
    "Pm",
    "Sm",
    "Eu",
    "Gd",
    "Tb",
    "Dy",
    "Ho",
    "Er",
    "Tm",
    "Yb",
    "Lu",
    "Hf",
    "Ta",
    "W",
    "Re",
    "Os",
    "Ir",
    "Pt",
    "Au",
    "Hg",
    "Tl",
    "Pb",
    "Bi",
    "Po",
    "At",
    "Rn",
    "Fr",
    "Ra",
    "Ac",
    "Th",
    "Pa",
    "U",
    "Np",
    "Pu",
    "Am",
    "Cm",
    "Bk",
    "Cf",
    "Es",
    "Fm",
    "Md",
    "No",
    "Lr",
    "Rf",
    "Db",
    "Sg",
    "Bh",
    "Hs",
    "Mt",
    "Ds",
    "Rg",
    "Cn",
    "Nh",
    "Fl",
    "Mc",
    "Lv",
    "Ts",
    "Og",
  ].map((element, index) => [element, index + 1]),
);

export function createAutoDistinctElementColorOverrides({
  atoms,
  elementColor,
  enabled,
}: {
  atoms: readonly AtomSpec[];
  elementColor: (element: string) => string;
  enabled: boolean;
}): ElementColorOverrides | undefined {
  if (!enabled) {
    return undefined;
  }

  const elementCounts = countCanonicalElements(atoms);
  const elements = Array.from(elementCounts.keys());
  if (elements.length < 2) {
    return undefined;
  }

  const baseColors: Record<string, string> = {};
  for (const element of elements) {
    baseColors[element] = elementColor(element);
  }
  const baseOklchColors = new Map(
    elements.map((element) => [element, hexToOklch(recordColor(baseColors, element))]),
  );
  const conflicts = buildColorConflictGraph(elements, baseOklchColors);
  if (!hasAnyConflicts(conflicts)) {
    return undefined;
  }

  const resolvedColors: Record<string, string> = { ...baseColors };
  let changed = false;

  for (const component of conflictComponents(elements, conflicts)) {
    if (component.length < 2) {
      continue;
    }

    const sortedElements = [...component].sort((left, right) =>
      compareElementRecolorResistance(right, left, elementCounts, conflicts),
    );

    for (const element of sortedElements.slice(1)) {
      if (!elementHasConflict(element, resolvedColors, elements)) {
        continue;
      }

      const baseColor = recordColor(baseColors, element);
      const nextColor = bestLocalVariant(
        element,
        baseColor,
        resolvedColors,
        elements,
      );
      if (nextColor !== recordColor(resolvedColors, element)) {
        resolvedColors[element] = nextColor;
        changed = true;
      }
    }
  }

  if (!changed) {
    return undefined;
  }

  return Object.fromEntries(
    elements
      .filter((element) => recordColor(resolvedColors, element) !== recordColor(baseColors, element))
      .map((element) => [element, recordColor(resolvedColors, element)]),
  );
}

function countCanonicalElements(atoms: readonly AtomSpec[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const atom of atoms) {
    if (atom.isPeriodicImage) {
      continue;
    }
    counts.set(atom.element, (counts.get(atom.element) ?? 0) + 1);
  }

  if (counts.size > 0) {
    return counts;
  }

  for (const atom of atoms) {
    counts.set(atom.element, (counts.get(atom.element) ?? 0) + 1);
  }
  return counts;
}

function buildColorConflictGraph(
  elements: readonly string[],
  colors: ReadonlyMap<string, OklchColor>,
): Map<string, Set<string>> {
  const conflicts = new Map(elements.map((element) => [element, new Set<string>()]));

  for (let index = 0; index < elements.length; index += 1) {
    const left = elements[index];
    if (left === undefined) {
      continue;
    }
    const leftColor = colors.get(left);
    if (!leftColor) {
      continue;
    }

    for (const right of elements.slice(index + 1)) {
      const rightColor = colors.get(right);
      if (!rightColor) {
        continue;
      }

      if (oklchDistance(leftColor, rightColor) < SIMILAR_COLOR_DISTANCE_THRESHOLD) {
        conflicts.get(left)?.add(right);
        conflicts.get(right)?.add(left);
      }
    }
  }

  return conflicts;
}

function hasAnyConflicts(conflicts: ReadonlyMap<string, ReadonlySet<string>>): boolean {
  return Array.from(conflicts.values()).some((edges) => edges.size > 0);
}

function conflictComponents(
  elements: readonly string[],
  conflicts: ReadonlyMap<string, ReadonlySet<string>>,
): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const element of elements) {
    if (visited.has(element)) {
      continue;
    }

    const component: string[] = [];
    const stack = [element];
    visited.add(element);

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      component.push(current);
      for (const next of conflicts.get(current) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }

    components.push(component);
  }

  return components;
}

function compareElementRecolorResistance(
  left: string,
  right: string,
  elementCounts: ReadonlyMap<string, number>,
  conflicts: ReadonlyMap<string, ReadonlySet<string>>,
): number {
  return (
    semanticAnchorRank(left) - semanticAnchorRank(right) ||
    (elementCounts.get(left) ?? 0) - (elementCounts.get(right) ?? 0) ||
    (conflicts.get(right)?.size ?? 0) - (conflicts.get(left)?.size ?? 0) ||
    elementOrder(right) - elementOrder(left)
  );
}

function semanticAnchorRank(element: string): number {
  if (STRONG_SEMANTIC_ELEMENTS.has(element)) {
    return 3;
  }
  if (SECONDARY_SEMANTIC_ELEMENTS.has(element)) {
    return 2;
  }
  if (MATERIAL_ANCHOR_ELEMENTS.has(element)) {
    return 1;
  }
  return 0;
}

function elementOrder(element: string): number {
  return ELEMENT_ORDER.get(element) ?? Number.MAX_SAFE_INTEGER;
}

function elementHasConflict(
  element: string,
  colors: Readonly<Record<string, string>>,
  elements: readonly string[],
): boolean {
  const color = recordColor(colors, element);
  const oklchColor = hexToOklch(color);
  return elements.some((otherElement) => {
    if (otherElement === element) {
      return false;
    }
    return (
      oklchDistance(oklchColor, hexToOklch(recordColor(colors, otherElement))) <
      SIMILAR_COLOR_DISTANCE_THRESHOLD
    );
  });
}

function bestLocalVariant(
  element: string,
  baseColor: string,
  colors: Readonly<Record<string, string>>,
  elements: readonly string[],
): string {
  const source = hexToOklch(baseColor);
  const sourceColor = hexToOklch(baseColor);
  let bestColor = recordColor(colors, element);
  let bestScore = localVariantScore(element, bestColor, sourceColor, colors, elements);

  for (const hueDelta of LOCAL_HUE_DELTAS) {
    for (const lightnessDelta of LOCAL_LIGHTNESS_DELTAS) {
      for (const chromaScale of LOCAL_CHROMA_SCALES) {
        if (hueDelta === 0 && lightnessDelta === 0 && chromaScale === 1) {
          continue;
        }

        const candidate = oklchToInGamutHex({
          chroma: source.chroma * chromaScale,
          hue: source.hue + hueDelta,
          lightness: clamp(source.lightness + lightnessDelta, 0.28, 0.92),
        });
        const score = localVariantScore(element, candidate, sourceColor, colors, elements);
        if (score > bestScore) {
          bestColor = candidate;
          bestScore = score;
        }
      }
    }
  }

  return bestColor;
}

function localVariantScore(
  element: string,
  candidate: string,
  sourceColor: OklchColor,
  colors: Readonly<Record<string, string>>,
  elements: readonly string[],
): number {
  const candidateColor = hexToOklch(candidate);
  const minDistance = Math.min(
    ...elements
      .filter((otherElement) => otherElement !== element)
      .map((otherElement) =>
        oklchDistance(candidateColor, hexToOklch(recordColor(colors, otherElement))),
      ),
  );
  const sourceDistance = oklchDistance(candidateColor, sourceColor);
  return minDistance * 4 - sourceDistance;
}

function recordColor(colors: Readonly<Record<string, string>>, element: string): string {
  const color = colors[element];
  if (color === undefined) {
    throw new Error(`No color is defined for element ${element}.`);
  }
  return color;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
