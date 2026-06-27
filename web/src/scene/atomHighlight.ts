import { Color } from "three";

import type { StructureMeshMaterial } from "./StructureMaterial";

export const ATOM_HIGHLIGHT_TARGET_COLOR = new Color("#ffffff");
export const ATOM_HIGHLIGHT_PULSE_MS = 240;
export const ATOM_HIGHLIGHT_SELECT_MS = 150;
export const ATOM_HIGHLIGHT_EMISSIVE_COLOR_MIX = 0.5;
export const ATOM_HIGHLIGHT_SELECTED_COLOR_MIX = 0.26;
export const ATOM_HIGHLIGHT_PULSE_COLOR_MIX = 0.34;
export const ATOM_HIGHLIGHT_SELECTED_EMISSIVE_INTENSITY = 0.32;
export const ATOM_HIGHLIGHT_PULSE_EMISSIVE_INTENSITY = 0.42;
export const ATOM_HIGHLIGHT_HALO_SELECTED_SCALE = 1.12;
export const ATOM_HIGHLIGHT_HALO_PULSE_MIN_SCALE = 1.03;
export const ATOM_HIGHLIGHT_HALO_SELECTED_OPACITY = 0.28;

export function applyAtomHighlight(
  material: StructureMeshMaterial,
  baseColor: Color,
  colorMix: number,
  emissiveIntensity: number,
) {
  material.color.copy(baseColor).lerp(ATOM_HIGHLIGHT_TARGET_COLOR, colorMix);
  if ("emissive" in material) {
    material.emissive
      .copy(baseColor)
      .lerp(ATOM_HIGHLIGHT_TARGET_COLOR, ATOM_HIGHLIGHT_EMISSIVE_COLOR_MIX);
    material.emissiveIntensity = emissiveIntensity;
  }
}

export function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

export function atomPulseFade(progress: number): number {
  const fadeIn = Math.min(1, progress / 0.28);
  const fadeOut = progress < 0.28 ? 1 : 1 - (progress - 0.28) / 0.72;
  return fadeIn * Math.max(0, fadeOut) ** 0.72;
}
