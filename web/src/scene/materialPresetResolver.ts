import {
  materialPresetById,
  type MaterialPreset,
  type MaterialPresetLight,
  type MaterialPresetMaterial,
  type MaterialPresetOverrideTarget,
} from "../model/materialPresets";
import type { StyleState } from "../model/appearance";

export const STRUCTURE_MATERIAL_TARGETS = [
  "atom",
  "bond",
  "polyhedron",
] as const;
export type StructureMaterialTarget = (typeof STRUCTURE_MATERIAL_TARGETS)[number];

export interface ResolvedStructureMaterialFamilies {
  atom: ResolvedStructureMaterialFamily;
  bond: ResolvedStructureMaterialFamily;
  polyhedron: ResolvedStructureMaterialFamily;
}

export interface ResolvedStructureMaterialFamily {
  id: string;
  label: string;
  lighting: MaterialPresetLight[];
  material: MaterialPresetMaterial;
}

export function resolveStructureMaterialFamilyForStyle(
  style: Pick<StyleState, "materialPreset">,
): ResolvedStructureMaterialFamily {
  return materialPresetToFamily(materialPresetById(style.materialPreset));
}

export function resolveStructureMaterialFamiliesForStyle(
  style: Pick<StyleState, "materialPreset">,
): ResolvedStructureMaterialFamilies {
  return {
    atom: resolveStructureMaterialFamilyForTarget(style, "atom"),
    bond: resolveStructureMaterialFamilyForTarget(style, "bond"),
    polyhedron: resolveStructureMaterialFamilyForTarget(style, "polyhedron"),
  };
}

export function resolveStructureMaterialFamilyForTarget(
  style: Pick<StyleState, "materialPreset">,
  target: StructureMaterialTarget,
): ResolvedStructureMaterialFamily {
  return materialPresetToFamily(materialPresetById(style.materialPreset), target);
}

function materialPresetToFamily(
  preset: MaterialPreset,
  target?: MaterialPresetOverrideTarget,
): ResolvedStructureMaterialFamily {
  const material = resolvePresetMaterialForTarget(preset, target);
  return {
    id: preset.id,
    label: preset.label,
    lighting: preset.lighting,
    material,
  };
}

function resolvePresetMaterialForTarget(
  preset: MaterialPreset,
  target?: MaterialPresetOverrideTarget,
): MaterialPresetMaterial {
  const override = target ? preset.overrides?.[target]?.material : undefined;
  if (!override) {
    return preset.material;
  }

  return {
    props: {
      ...preset.material.props,
      ...override.props,
    },
    type: override.type,
  };
}
