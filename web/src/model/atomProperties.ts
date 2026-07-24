import type { SceneSpec } from "../api/scene";
import type { AtomPropertySeries } from "../api/trajectory";

export const PROPERTY_COORDINATION = "coordination.total";
export const PROPERTY_BOND_MIN = "bondDistance.min";
export const PROPERTY_BOND_MEAN = "bondDistance.mean";
export const PROPERTY_BOND_MAX = "bondDistance.max";
export const PROPERTY_DISPLACEMENT = "displacement.frame0";
export const PROPERTY_COORDINATION_ELEMENT_PREFIX = "coordination.element:";

export type ScalarPalette = "viridis" | "plasma" | "cividis" | "coolwarm";
export type PropertyFilterOperator = "lt" | "lte" | "eq" | "neq" | "gte" | "gt" | "between";
export type PropertyFilterLogic = "and" | "or";

export interface PropertyFilterCondition {
  id: string;
  propertyId: string;
  operator: PropertyFilterOperator;
  value: number;
  upperValue?: number;
}

export interface ScalarPropertySnapshot extends AtomPropertySeries {
  values: Array<number | null>;
}

export interface ScalarLegendSpec {
  label: string;
  unit: string;
  domain: { min: number; max: number };
  palette: ScalarPalette;
}

export function scalarPaletteCss(palette: ScalarPalette): string {
  return `linear-gradient(90deg, ${PALETTES[palette]
    .map((_, index) => interpolatePalette(palette, index / (PALETTES[palette].length - 1)))
    .join(", ")})`;
}

export interface AtomPropertyOption {
  id: string;
  label: string;
}

export interface AtomPropertyControlState {
  colorPropertyId: string | null;
  palette: ScalarPalette;
  manualDomain: { min: number; max: number } | null;
  filterEnabled: boolean;
  filterLogic: PropertyFilterLogic;
  conditions: PropertyFilterCondition[];
}

export function createDefaultAtomPropertyControlState(): AtomPropertyControlState {
  return {
    colorPropertyId: null,
    palette: "viridis",
    manualDomain: null,
    filterEnabled: false,
    filterLogic: "and",
    conditions: [],
  };
}

const PALETTES: Record<ScalarPalette, readonly [number, number, number][]> = {
  viridis: [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]],
  plasma: [[13, 8, 135], [126, 3, 168], [204, 71, 120], [248, 149, 64], [240, 249, 33]],
  cividis: [[0, 34, 78], [66, 78, 108], [124, 123, 120], [188, 174, 108], [254, 232, 56]],
  coolwarm: [[59, 76, 192], [141, 176, 254], [221, 221, 221], [244, 152, 122], [180, 4, 38]],
};

export function atomPropertyOptions(
  elements: readonly string[],
  hasTrajectory: boolean,
): AtomPropertyOption[] {
  return [
    { id: PROPERTY_COORDINATION, label: "Coordination" },
    ...elements.map((element) => ({
      id: `${PROPERTY_COORDINATION_ELEMENT_PREFIX}${element}`,
      label: `Coordination by ${element}`,
    })),
    { id: PROPERTY_BOND_MIN, label: "Minimum bond distance" },
    { id: PROPERTY_BOND_MEAN, label: "Mean bond distance" },
    { id: PROPERTY_BOND_MAX, label: "Maximum bond distance" },
    ...(hasTrajectory
      ? [{ id: PROPERTY_DISPLACEMENT, label: "Displacement from frame 0" }]
      : []),
  ];
}

export function staticSceneAtomProperties(
  scene: SceneSpec,
  propertyIds: readonly string[],
): Record<string, ScalarPropertySnapshot> {
  const atomCount = scene.summary.atomCount;
  const distances = Array.from({ length: atomCount }, () => [] as number[]);
  const neighbors = Array.from({ length: atomCount }, () => [] as string[]);
  for (const bond of scene.bonds) {
    const start = scene.atoms[bond.startAtomIndex];
    const end = scene.atoms[bond.endAtomIndex];
    if (!start || !end) {
      continue;
    }
    const distance = Math.hypot(
      end.position[0] - start.position[0],
      end.position[1] - start.position[1],
      end.position[2] - start.position[2],
    );
    distances[start.siteIndex]?.push(distance);
    neighbors[start.siteIndex]?.push(end.element);
    distances[end.siteIndex]?.push(distance);
    neighbors[end.siteIndex]?.push(start.element);
  }

  const result: Record<string, ScalarPropertySnapshot> = {};
  for (const propertyId of propertyIds) {
    let label = propertyId;
    let unit = "";
    let values: Array<number | null>;
    if (propertyId === PROPERTY_COORDINATION) {
      label = "Coordination";
      values = distances.map((rows) => rows.length);
    } else if (propertyId.startsWith(PROPERTY_COORDINATION_ELEMENT_PREFIX)) {
      const element = propertyId.slice(PROPERTY_COORDINATION_ELEMENT_PREFIX.length);
      label = `Coordination by ${element}`;
      values = neighbors.map((rows) => rows.filter((value) => value === element).length);
    } else if (propertyId === PROPERTY_BOND_MIN) {
      label = "Minimum bond distance";
      unit = "Å";
      values = distances.map((rows) => rows.length ? Math.min(...rows) : null);
    } else if (propertyId === PROPERTY_BOND_MEAN) {
      label = "Mean bond distance";
      unit = "Å";
      values = distances.map((rows) => rows.length
        ? rows.reduce((total, value) => total + value, 0) / rows.length
        : null);
    } else if (propertyId === PROPERTY_BOND_MAX) {
      label = "Maximum bond distance";
      unit = "Å";
      values = distances.map((rows) => rows.length ? Math.max(...rows) : null);
    } else {
      continue;
    }
    result[propertyId] = {
      propertyId,
      label,
      unit,
      values,
      domain: finitePropertyDomain(values),
    };
  }
  return result;
}

export function matchingSiteIndices(
  properties: Readonly<Record<string, ScalarPropertySnapshot>>,
  conditions: readonly PropertyFilterCondition[],
  logic: PropertyFilterLogic,
): ReadonlySet<number> | null {
  if (conditions.length === 0) {
    return null;
  }
  const first = properties[conditions[0]!.propertyId];
  if (!first || conditions.some((condition) => !properties[condition.propertyId])) {
    return null;
  }
  const matches = new Set<number>();
  for (let siteIndex = 0; siteIndex < first.values.length; siteIndex += 1) {
    const rows = conditions.map((condition) => conditionMatches(
      properties[condition.propertyId]!.values[siteIndex] ?? null,
      condition,
    ));
    if (logic === "and" ? rows.every(Boolean) : rows.some(Boolean)) {
      matches.add(siteIndex);
    }
  }
  return matches;
}

export function scalarSiteColors(
  snapshot: ScalarPropertySnapshot,
  palette: ScalarPalette,
  manualDomain?: { min: number; max: number } | null,
): ReadonlyMap<number, string> {
  const domain = scalarPropertyDomain(snapshot, manualDomain);
  const result = new Map<number, string>();
  if (!domain) {
    return result;
  }
  const span = domain.max - domain.min || 1;
  snapshot.values.forEach((value, siteIndex) => {
    result.set(
      siteIndex,
      value === null || !Number.isFinite(value)
        ? "#9ca3af"
        : interpolatePalette(palette, (value - domain.min) / span),
    );
  });
  return result;
}

export function scalarPropertyDomain(
  snapshot: ScalarPropertySnapshot,
  manualDomain?: { min: number; max: number } | null,
): { min: number; max: number } | undefined {
  if (
    manualDomain
    && Number.isFinite(manualDomain.min)
    && Number.isFinite(manualDomain.max)
    && manualDomain.max > manualDomain.min
  ) {
    return manualDomain;
  }
  return snapshot.domain ?? finitePropertyDomain(snapshot.values);
}

export function finitePropertyDomain(
  values: readonly (number | null)[],
): { min: number; max: number } | undefined {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (finite.length === 0) {
    return undefined;
  }
  return { min: Math.min(...finite), max: Math.max(...finite) };
}

export function interpolatePalette(palette: ScalarPalette, value: number): string {
  const stops = PALETTES[palette];
  const scaled = Math.min(1, Math.max(0, value)) * (stops.length - 1);
  const lower = Math.floor(scaled);
  const upper = Math.min(stops.length - 1, lower + 1);
  const mix = scaled - lower;
  const first = stops[lower]!;
  const second = stops[upper]!;
  const channel = (index: number) => Math.round(first[index]! + (second[index]! - first[index]!) * mix);
  return `#${[channel(0), channel(1), channel(2)]
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("")}`;
}

function conditionMatches(value: number | null, condition: PropertyFilterCondition): boolean {
  if (value === null || !Number.isFinite(value)) {
    return false;
  }
  switch (condition.operator) {
    case "lt": return value < condition.value;
    case "lte": return value <= condition.value;
    case "eq": return Math.abs(value - condition.value) <= 1e-9;
    case "neq": return Math.abs(value - condition.value) > 1e-9;
    case "gte": return value >= condition.value;
    case "gt": return value > condition.value;
    case "between": {
      const upper = condition.upperValue ?? condition.value;
      return value >= Math.min(condition.value, upper) && value <= Math.max(condition.value, upper);
    }
  }
}
