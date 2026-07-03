import type { BondCutoffSpec, SceneSpec } from "../api/scene";

export interface BondCutoffPair {
  key: string;
  elements: [string, string];
  distance: number;
}

// Cutoff distances above a few nanometres are never physical bonds and only
// slow the neighbour search down, so the editor clamps to this range.
export const MIN_BOND_CUTOFF = 0;
export const MAX_BOND_CUTOFF = 10;

export function bondCutoffKey(firstElement: string, secondElement: string): string {
  return [firstElement, secondElement].sort().join("–");
}

export function clampBondCutoff(distance: number): number {
  if (!Number.isFinite(distance)) {
    return MIN_BOND_CUTOFF;
  }
  return Math.min(MAX_BOND_CUTOFF, Math.max(MIN_BOND_CUTOFF, distance));
}

export function bondCutoffPairsFromScene(scene: SceneSpec | null): BondCutoffPair[] {
  if (!scene) {
    return [];
  }

  return (scene.bondCutoffs ?? []).map((entry) =>
    bondCutoffPair(entry.elements, entry.distance),
  );
}

export function bondCutoffPair(
  elements: readonly [string, string],
  distance: number,
): BondCutoffPair {
  const sorted = [...elements].sort() as [string, string];
  return {
    key: sorted.join("–"),
    elements: sorted,
    distance: clampBondCutoff(distance),
  };
}

export function updateBondCutoff(
  pairs: BondCutoffPair[],
  key: string,
  distance: number,
): BondCutoffPair[] {
  return pairs.map((pair) =>
    pair.key === key ? { ...pair, distance: clampBondCutoff(distance) } : pair,
  );
}

export function bondCutoffsToSpecs(pairs: BondCutoffPair[]): BondCutoffSpec[] {
  return pairs.map((pair) => ({ elements: pair.elements, distance: pair.distance }));
}

export function bondCutoffPairsEqual(
  firstPairs: BondCutoffPair[],
  secondPairs: BondCutoffPair[],
): boolean {
  if (firstPairs.length !== secondPairs.length) {
    return false;
  }

  const distanceByKey = new Map(secondPairs.map((pair) => [pair.key, pair.distance]));
  return firstPairs.every((pair) => distanceByKey.get(pair.key) === pair.distance);
}
