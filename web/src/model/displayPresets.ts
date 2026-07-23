import type {
  ComponentOpacityState,
  ComponentVisibilityState,
} from "./displayState";
import type { StyleState } from "./appearance";
import type { PeriodicCellRange } from "./periodicReplication";
import type { CrystalCameraState } from "./crystalCameraState";
import type { MeshQuality } from "./exportSettings";
import type { UnitCellLineStyle } from "./rendering";
import { COLOR_SCHEMES } from "./colorSchemes";
import { MATERIAL_PRESET_CATALOG } from "./materialPresets";

export const DISPLAY_PRESET_SCHEMA_VERSION = 1;
export const DISPLAY_PRESET_STORAGE_KEY = "glance.display-presets.v1";

export interface DisplayPresetSnapshot {
  componentOpacity: ComponentOpacityState;
  componentVisibility: ComponentVisibilityState;
  periodicCellRange: PeriodicCellRange;
  cameraState: CrystalCameraState;
  viewScale: number;
  style: StyleState;
  lightStrength: number;
  unitCellLineStyle: UnitCellLineStyle;
  showCrystalAxisLabels: boolean;
  previewMeshQuality: MeshQuality;
}

export interface DisplayPreset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: DisplayPresetSnapshot;
}

export interface DisplayPresetBundle {
  schemaVersion: 1;
  presets: DisplayPreset[];
}

export function createDisplayPreset(name: string, snapshot: DisplayPresetSnapshot): DisplayPreset {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: normalizedPresetName(name),
    createdAt: timestamp,
    updatedAt: timestamp,
    snapshot: cloneSnapshot(snapshot),
  };
}

export function serializeDisplayPresets(presets: readonly DisplayPreset[]): string {
  return JSON.stringify({ schemaVersion: DISPLAY_PRESET_SCHEMA_VERSION, presets }, null, 2);
}

export function parseDisplayPresets(text: string): DisplayPreset[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The preset file is not valid JSON.");
  }
  if (!isObject(parsed) || parsed.schemaVersion !== DISPLAY_PRESET_SCHEMA_VERSION) {
    throw new Error("Unsupported preset schema version.");
  }
  if (!Array.isArray(parsed.presets) || !parsed.presets.every(isDisplayPreset)) {
    throw new Error("The preset file is damaged or incomplete.");
  }
  return parsed.presets.map((preset) => ({ ...preset, snapshot: cloneSnapshot(preset.snapshot) }));
}

export function loadDisplayPresets(storage: Pick<Storage, "getItem"> = localStorage): {
  presets: DisplayPreset[];
  error: string | null;
} {
  const stored = storage.getItem(DISPLAY_PRESET_STORAGE_KEY);
  if (!stored) {
    return { presets: [], error: null };
  }
  try {
    const parsed = parseDisplayPresets(stored);
    const presets = uniquifyDisplayPresetNames(parsed);
    const renamed = presets.some((preset, index) => preset.name !== parsed[index]?.name);
    return {
      presets,
      error: renamed ? "Duplicate preset names were renamed for clarity." : null,
    };
  } catch (error) {
    return { presets: [], error: error instanceof Error ? error.message : "Saved presets are invalid." };
  }
}

export function saveDisplayPresets(
  presets: readonly DisplayPreset[],
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(DISPLAY_PRESET_STORAGE_KEY, serializeDisplayPresets(presets));
}

export function overwriteDisplayPreset(
  preset: DisplayPreset,
  snapshot: DisplayPresetSnapshot,
): DisplayPreset {
  return {
    ...preset,
    updatedAt: new Date().toISOString(),
    snapshot: cloneSnapshot(snapshot),
  };
}

export function renameDisplayPreset(preset: DisplayPreset, name: string): DisplayPreset {
  return { ...preset, name: normalizedPresetName(name), updatedAt: new Date().toISOString() };
}

export function findDisplayPresetByName(
  presets: readonly DisplayPreset[],
  name: string,
  excludeId?: string,
): DisplayPreset | null {
  const key = presetNameKey(name);
  if (!key) {
    return null;
  }
  return presets.find((preset) => (
    preset.id !== excludeId && presetNameKey(preset.name) === key
  )) ?? null;
}

export function assertUniqueDisplayPresetNames(presets: readonly DisplayPreset[]): void {
  const names = new Set<string>();
  for (const preset of presets) {
    const key = presetNameKey(normalizedPresetName(preset.name));
    if (names.has(key)) {
      throw new Error(`Preset names must be unique; "${preset.name}" appears more than once.`);
    }
    names.add(key);
  }
}

export function uniquifyDisplayPresetNames(
  presets: readonly DisplayPreset[],
): DisplayPreset[] {
  const names = new Set<string>();
  return presets.map((preset) => {
    const base = normalizedPresetName(preset.name);
    let candidate = base;
    let suffix = 2;
    while (names.has(presetNameKey(candidate))) {
      const suffixText = ` (${suffix})`;
      candidate = `${base.slice(0, 80 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }
    names.add(presetNameKey(candidate));
    return candidate === preset.name ? preset : { ...preset, name: candidate };
  });
}

function normalizedPresetName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("Preset name cannot be empty.");
  }
  return normalized.slice(0, 80);
}

function presetNameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function cloneSnapshot(snapshot: DisplayPresetSnapshot): DisplayPresetSnapshot {
  return structuredClone(snapshot);
}

function isDisplayPreset(value: unknown): value is DisplayPreset {
  if (!isObject(value) || typeof value.id !== "string" || typeof value.name !== "string"
      || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") {
    return false;
  }
  return isDisplayPresetSnapshot(value.snapshot);
}

function isDisplayPresetSnapshot(value: unknown): value is DisplayPresetSnapshot {
  if (!isObject(value)) {
    return false;
  }
  const visibility = value.componentVisibility;
  const opacity = value.componentOpacity;
  const range = value.periodicCellRange;
  const camera = value.cameraState;
  const style = value.style;
  return isBooleanRecord(visibility, ["atoms", "unitCell", "bonds", "polyhedra", "boundaryAtoms", "oneHopBondedAtoms"])
    && isNumberRecord(opacity, ["atoms", "unitCell", "bonds", "polyhedra"])
    && isPeriodicRange(range)
    && isObject(camera)
    && isVector(camera.direct) && isVector(camera.reciprocal)
    && ["right", "upward", "outward"].includes(String(camera.primary))
    && ["right", "upward", "outward"].includes(String(camera.secondary))
    && isFiniteNumber(camera.rollDegrees)
    && isObject(style)
    && isNumberInRange(style.atomRadius, 0, 100)
    && ["uniform", "atomic", "vdw", "ionic"].includes(String(style.atomRadiusModel))
    && isHexColor(style.bondColor)
    && ["unicolor", "bicolor"].includes(String(style.bondColorMode))
    && isNumberInRange(style.bondThickness, 0, 200)
    && COLOR_SCHEMES.some((entry) => entry.id === style.colorScheme)
    && ["preset", "custom"].includes(String(style.colorSchemeMode))
    && isCustomColormap(style.customColormap)
    && typeof style.distinguishSimilarColors === "boolean"
    && typeof style.fogAffectsUnitCell === "boolean" && isNumberInRange(style.fogAmount, 0, 100)
    && typeof style.fogEnabled === "boolean" && isNumberInRange(style.fogStart, 0, 100)
    && MATERIAL_PRESET_CATALOG.presets.some((entry) => entry.id === style.materialPreset)
    && isNumberInRange(value.viewScale, 0.2, 5)
    && isNumberInRange(value.lightStrength, 0.5, 2)
    && (value.unitCellLineStyle === "solid" || value.unitCellLineStyle === "dashed")
    && typeof value.showCrystalAxisLabels === "boolean"
    && ["low", "medium", "high", "xhigh"].includes(String(value.previewMeshQuality));
}

function isPeriodicRange(value: unknown): value is PeriodicCellRange {
  return isObject(value) && ["a", "b", "c"].every((axis) => {
    const range = value[axis];
    return isObject(range) && Number.isSafeInteger(range.from) && Number.isSafeInteger(range.to);
  });
}

function isBooleanRecord(value: unknown, keys: readonly string[]): boolean {
  return isObject(value) && keys.every((key) => typeof value[key] === "boolean");
}

function isNumberRecord(value: unknown, keys: readonly string[]): boolean {
  return isObject(value) && keys.every((key) => isFiniteNumber(value[key]));
}

function isVector(value: unknown): boolean {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
}

function isCustomColormap(value: unknown): boolean {
  if (value === null) {
    return true;
  }
  if (!isObject(value) || !COLOR_SCHEMES.some((entry) => entry.id === value.baseColorScheme)
      || !isObject(value.elements)) {
    return false;
  }
  return Object.values(value.elements).every(isHexColor);
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
}

function isNumberInRange(value: unknown, min: number, max: number): boolean {
  return isFiniteNumber(value) && value >= min && value <= max;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
