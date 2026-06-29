import type { CSSProperties } from "react";

import type { AtomSpec } from "../api/scene";
import colormapCatalogData from "../data/colormaps/catalog.json";
import jmolSoftColormap from "../data/colormaps/presets/jmol-soft.json";
import jmolColormap from "../data/colormaps/presets/jmol.json";
import vestaSoftColormap from "../data/colormaps/presets/vesta-soft.json";
import vestaColormap from "../data/colormaps/presets/vesta.json";

export type ColorScheme = string;

interface RawColormapData {
  elements: Record<string, string>;
  name: string;
}

export interface Colormap {
  elements: Record<string, string>;
  id: ColorScheme;
  label: string;
  tokenElements: readonly string[];
}

export interface ColormapCatalog {
  colormaps: Colormap[];
  defaultColorSchemeId: ColorScheme;
  version: 1;
}

export interface ColormapCatalogIndex {
  colormaps: ColormapCatalogEntry[];
  defaultColorSchemeId: ColorScheme;
  version: 1;
}

export interface ColormapCatalogEntry {
  file: string;
  id: ColorScheme;
  label: string;
  tokenElements: readonly string[];
}

export interface ColorSchemeOption {
  label: string;
  tokenStyle: CSSProperties;
  value: ColorScheme;
}

export type ElementColorOverrides = Readonly<Record<string, string>>;

const STATIC_COLORMAP_MODULES: Record<string, unknown> = {
  "../data/colormaps/presets/jmol-soft.json": jmolSoftColormap,
  "../data/colormaps/presets/jmol.json": jmolColormap,
  "../data/colormaps/presets/vesta-soft.json": vestaSoftColormap,
  "../data/colormaps/presets/vesta.json": vestaColormap,
};
const COLORMAP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COLORMAP_FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;
const ELEMENT_SYMBOL_PATTERN = /^[A-Z][a-z]{0,2}$|^D$|^XX$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;
const SIMILAR_COLOR_DISTANCE_THRESHOLD = 0.11;
const COLOR_DISTANCE_LIGHTNESS_WEIGHT = 0.65;
const COLOR_DISTANCE_CHROMA_WEIGHT = 1.2;
const COLOR_DISTANCE_HUE_WEIGHT = 2.0;
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

export const COLORMAP_CATALOG = buildColormapCatalog(
  colormapCatalogData,
  collectBundledColormapData(),
);
export const COLOR_SCHEMES = COLORMAP_CATALOG.colormaps;
export const DEFAULT_COLOR_SCHEME_ID = COLORMAP_CATALOG.defaultColorSchemeId;
export const COLOR_SCHEME_OPTIONS: ColorSchemeOption[] = COLOR_SCHEMES.map(
  (colormap) => ({
    label: colormap.label,
    tokenStyle: colormapTokenStyle(colormap),
    value: colormap.id,
  }),
);

export function atomColorForScheme(
  atom: AtomSpec,
  colorScheme: ColorScheme,
  overrides?: ElementColorOverrides,
): string {
  return elementColorForScheme(atom.element, colorScheme, overrides);
}

export function hasElementColor(element: string, colorScheme: ColorScheme): boolean {
  return colormapById(colorScheme).elements[element] !== undefined;
}

export function elementColorForScheme(
  element: string,
  colorScheme: ColorScheme,
  overrides?: ElementColorOverrides,
): string {
  const override = overrides?.[element];
  if (override !== undefined) {
    return override;
  }

  const color = colormapById(colorScheme).elements[element];
  if (color === undefined) {
    throw new Error(`No ${colorScheme} color is defined for element ${element}.`);
  }
  return color;
}

export function colorSchemeTokenStyle(colorScheme: ColorScheme): CSSProperties {
  return colormapTokenStyle(colormapById(colorScheme));
}

export function autoDistinctElementColorOverrides(
  atoms: readonly AtomSpec[],
  colorScheme: ColorScheme,
  enabled: boolean,
): ElementColorOverrides | undefined {
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
    baseColors[element] = elementColorForScheme(element, colorScheme);
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

interface OklabColor {
  a: number;
  b: number;
  lightness: number;
}

interface OklchColor {
  chroma: number;
  hue: number;
  lightness: number;
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

function hexToOklch(hex: string): OklchColor {
  const lab = hexToOklab(hex);
  return {
    chroma: Math.hypot(lab.a, lab.b),
    hue: (Math.atan2(lab.b, lab.a) * 180) / Math.PI,
    lightness: lab.lightness,
  };
}

function hexToOklab(hex: string): OklabColor {
  const [red, green, blue] = hexToLinearSrgb(hex);
  const long = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const medium = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const short = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;

  const longRoot = Math.cbrt(long);
  const mediumRoot = Math.cbrt(medium);
  const shortRoot = Math.cbrt(short);

  return {
    lightness:
      0.2104542553 * longRoot + 0.793617785 * mediumRoot - 0.0040720468 * shortRoot,
    a: 1.9779984951 * longRoot - 2.428592205 * mediumRoot + 0.4505937099 * shortRoot,
    b: 0.0259040371 * longRoot + 0.7827717662 * mediumRoot - 0.808675766 * shortRoot,
  };
}

function recordColor(colors: Readonly<Record<string, string>>, element: string): string {
  const color = colors[element];
  if (color === undefined) {
    throw new Error(`No color is defined for element ${element}.`);
  }
  return color;
}

function oklabDistance(left: OklabColor, right: OklabColor): number {
  return Math.hypot(
    left.lightness - right.lightness,
    left.a - right.a,
    left.b - right.b,
  );
}

function oklchDistance(left: OklchColor, right: OklchColor): number {
  const lightnessDistance =
    COLOR_DISTANCE_LIGHTNESS_WEIGHT * (left.lightness - right.lightness);
  const chromaDistance = COLOR_DISTANCE_CHROMA_WEIGHT * (left.chroma - right.chroma);
  const hueArcDistance =
    COLOR_DISTANCE_HUE_WEIGHT *
    ((left.chroma + right.chroma) / 2) *
    hueDistanceRadians(left.hue, right.hue);
  return Math.hypot(lightnessDistance, chromaDistance, hueArcDistance);
}

function hueDistanceRadians(left: number, right: number): number {
  const degrees = Math.abs(((left - right + 180) % 360) - 180);
  return (degrees * Math.PI) / 180;
}

function oklchToInGamutHex(color: OklchColor): string {
  if (inGamut(oklchToLinearSrgb(color))) {
    return linearSrgbToHex(oklchToLinearSrgb(color));
  }

  let low = 0;
  let high = color.chroma;
  for (let index = 0; index < 28; index += 1) {
    const mid = (low + high) / 2;
    if (inGamut(oklchToLinearSrgb({ ...color, chroma: mid }))) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return linearSrgbToHex(oklchToLinearSrgb({ ...color, chroma: low }));
}

function oklchToLinearSrgb({ chroma, hue, lightness }: OklchColor): [number, number, number] {
  const hueRadians = (hue * Math.PI) / 180;
  const labA = chroma * Math.cos(hueRadians);
  const labB = chroma * Math.sin(hueRadians);

  const longRoot = lightness + 0.3963377774 * labA + 0.2158037573 * labB;
  const mediumRoot = lightness - 0.1055613458 * labA - 0.0638541728 * labB;
  const shortRoot = lightness - 0.0894841775 * labA - 1.291485548 * labB;

  const long = longRoot ** 3;
  const medium = mediumRoot ** 3;
  const short = shortRoot ** 3;

  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ];
}

function hexToSrgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function hexToLinearSrgb(hex: string): [number, number, number] {
  const [red, green, blue] = hexToSrgb(hex);
  return [
    srgbChannelToLinear(red),
    srgbChannelToLinear(green),
    srgbChannelToLinear(blue),
  ];
}

function srgbChannelToLinear(value: number): number {
  if (value <= 0.04045) {
    return value / 12.92;
  }
  return ((value + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(value: number): number {
  if (value <= 0.0031308) {
    return 12.92 * value;
  }
  return 1.055 * value ** (1 / 2.4) - 0.055;
}

function linearSrgbToHex([red, green, blue]: [number, number, number]): string {
  const rgb = [red, green, blue]
    .map((channel) => linearChannelToSrgb(clamp(channel, 0, 1)))
    .map((channel) => Math.round(clamp(channel, 0, 1) * 255));
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function inGamut(rgb: readonly number[]): boolean {
  return rgb.every((channel) => channel >= -1e-9 && channel <= 1 + 1e-9);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function buildColormapCatalog(
  catalogData: unknown,
  colormapModules: Record<string, unknown>,
): ColormapCatalog {
  const catalogIndex = validateColormapCatalogIndex(catalogData);
  const colormapDataByFile = new Map<string, RawColormapData>();

  for (const [modulePath, moduleData] of Object.entries(colormapModules)) {
    const file = modulePath.split("/").at(-1);
    if (file === undefined) {
      throw new Error(`Bundled colormap path "${modulePath}" is invalid.`);
    }
    if (colormapDataByFile.has(file)) {
      throw new Error(`Duplicate bundled colormap file "${file}".`);
    }
    colormapDataByFile.set(
      file,
      parseRawColormap(moduleData, `colormap files.${file}`),
    );
  }

  const colormaps = catalogIndex.colormaps.map((entry) => {
    const data = colormapDataByFile.get(entry.file);
    if (!data) {
      throw new Error(
        `colormaps.catalog entry "${entry.id}" references missing file "${entry.file}".`,
      );
    }
    if (data.name !== entry.id) {
      throw new Error(
        `colormap file "${entry.file}" name "${data.name}" must match catalog id "${entry.id}".`,
      );
    }

    for (const element of entry.tokenElements) {
      if (data.elements[element] === undefined) {
        throw new Error(
          `colormaps.catalog entry "${entry.id}" token element "${element}" has no color.`,
        );
      }
    }

    return {
      elements: data.elements,
      id: entry.id,
      label: entry.label,
      tokenElements: entry.tokenElements,
    };
  });

  if (colormaps.length !== colormapDataByFile.size) {
    const catalogFiles = new Set(catalogIndex.colormaps.map((entry) => entry.file));
    const unlistedFile = Array.from(colormapDataByFile.keys()).find(
      (file) => !catalogFiles.has(file),
    );
    throw new Error(
      `Bundled colormap file "${unlistedFile ?? "unknown"}" is not listed in colormaps.catalog.`,
    );
  }

  return {
    colormaps,
    defaultColorSchemeId: catalogIndex.defaultColorSchemeId,
    version: catalogIndex.version,
  };
}

export function validateColormapCatalogIndex(data: unknown): ColormapCatalogIndex {
  const root = expectRecord(data, "colormaps.catalog");
  assertKnownKeys(root, "colormaps.catalog", [
    "colormaps",
    "defaultColorSchemeId",
    "version",
  ]);

  const version = root.version;
  if (version !== 1) {
    throw new Error("colormaps.catalog.version must be 1.");
  }

  const defaultColorSchemeId = expectColormapId(
    root.defaultColorSchemeId,
    "colormaps.catalog.defaultColorSchemeId",
  );
  if (!Array.isArray(root.colormaps) || root.colormaps.length === 0) {
    throw new Error("colormaps.catalog.colormaps must be a non-empty array.");
  }

  const ids = new Set<string>();
  const files = new Set<string>();
  const colormaps = root.colormaps.map((entry, index) => {
    const colormap = parseColormapCatalogEntry(
      entry,
      `colormaps.catalog.colormaps[${index}]`,
    );
    if (ids.has(colormap.id)) {
      throw new Error(`Duplicate colormap ID "${colormap.id}".`);
    }
    if (files.has(colormap.file)) {
      throw new Error(`Duplicate colormap file "${colormap.file}".`);
    }
    ids.add(colormap.id);
    files.add(colormap.file);
    return colormap;
  });

  if (!ids.has(defaultColorSchemeId)) {
    throw new Error(
      `colormaps.catalog.defaultColorSchemeId "${defaultColorSchemeId}" does not match a bundled colormap.`,
    );
  }

  return {
    colormaps,
    defaultColorSchemeId,
    version,
  };
}

function collectBundledColormapData(): Record<string, unknown> {
  if (typeof import.meta.glob === "function") {
    return import.meta.glob("../data/colormaps/presets/*.json", {
      eager: true,
      import: "default",
    });
  }

  return STATIC_COLORMAP_MODULES;
}

function colormapById(id: ColorScheme): Colormap {
  const colormap = COLOR_SCHEMES.find((candidate) => candidate.id === id);
  if (!colormap) {
    throw new Error(`Unknown color scheme ID "${id}".`);
  }

  return colormap;
}

function parseColormapCatalogEntry(
  data: unknown,
  path: string,
): ColormapCatalogEntry {
  const entry = expectRecord(data, path);
  assertKnownKeys(entry, path, ["file", "id", "label", "tokenElements"]);

  const id = expectColormapId(entry.id, `${path}.id`);
  return {
    file: expectColormapFile(entry.file, `${path}.file`),
    id,
    label: expectNonEmptyString(entry.label, `${path}.label`),
    tokenElements: expectTokenElements(entry.tokenElements, `${path}.tokenElements`),
  };
}

function parseRawColormap(data: unknown, path: string): RawColormapData {
  const colormap = expectRecord(data, path);
  assertKnownKeys(colormap, path, ["elements", "name"]);

  const name = expectColormapId(colormap.name, `${path}.name`);
  const elementsRoot = expectRecord(colormap.elements, `${path}.elements`);
  const elements: Record<string, string> = {};
  for (const [element, color] of Object.entries(elementsRoot)) {
    if (!ELEMENT_SYMBOL_PATTERN.test(element)) {
      throw new Error(`${path}.elements.${element} must be an element symbol.`);
    }
    elements[element] = expectHexColor(color, `${path}.elements.${element}`);
  }

  return { elements, name };
}

function colormapTokenStyle(colormap: Colormap): CSSProperties {
  const stops = colormap.tokenElements.map((element, index) => {
    const start = (index / colormap.tokenElements.length) * 100;
    const end = ((index + 1) / colormap.tokenElements.length) * 100;
    return `${colormap.elements[element]} ${start}% ${end}%`;
  });

  return {
    background: `linear-gradient(90deg, ${stops.join(", ")})`,
  };
}

function expectRecord(data: unknown, path: string): Record<string, unknown> {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(`${path} must be an object.`);
  }

  return data as Record<string, unknown>;
}

function assertKnownKeys(
  data: Record<string, unknown>,
  path: string,
  knownKeys: string[],
) {
  const allowedKeys = new Set(knownKeys);
  for (const key of Object.keys(data)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`${path}.${key} is not supported.`);
    }
  }
}

function expectNonEmptyString(data: unknown, path: string): string {
  if (typeof data !== "string" || data.trim() === "") {
    throw new Error(`${path} must be a non-empty string.`);
  }

  return data;
}

function expectColormapId(data: unknown, path: string): string {
  const value = expectNonEmptyString(data, path);
  if (!COLORMAP_ID_PATTERN.test(value)) {
    throw new Error(
      `${path} must use lowercase letters, numbers, and hyphen separators.`,
    );
  }

  return value;
}

function expectColormapFile(data: unknown, path: string): string {
  const value = expectNonEmptyString(data, path);
  if (!COLORMAP_FILE_PATTERN.test(value)) {
    throw new Error(
      `${path} must be a JSON filename using lowercase letters, numbers, and hyphen separators.`,
    );
  }

  return value;
}

function expectTokenElements(data: unknown, path: string): readonly string[] {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`${path} must be a non-empty array.`);
  }

  const elements = data.map((entry, index) => {
    const element = expectNonEmptyString(entry, `${path}[${index}]`);
    if (!ELEMENT_SYMBOL_PATTERN.test(element)) {
      throw new Error(`${path}[${index}] must be an element symbol.`);
    }
    return element;
  });

  return elements;
}

function expectHexColor(data: unknown, path: string): string {
  const value = expectNonEmptyString(data, path);
  if (!HEX_COLOR_PATTERN.test(value)) {
    throw new Error(`${path} must be a #RRGGBB or #RRGGBBAA hex color.`);
  }

  return value.toLowerCase();
}
