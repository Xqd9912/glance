import { type Ref } from "react";
import { MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, type Side } from "three";

import type { ResolvedStructureMaterialFamily } from "./materialPresetResolver";

export type StructureMeshMaterial = MeshBasicMaterial | MeshLambertMaterial | MeshStandardMaterial;

export function StructureMaterial({
  color,
  depthWrite,
  materialFamily,
  materialRef,
  opacity,
  side,
  transparent,
  vertexColors,
}: {
  color?: string;
  depthWrite: boolean;
  materialFamily: ResolvedStructureMaterialFamily;
  materialRef?: Ref<StructureMeshMaterial>;
  opacity: number;
  side?: Side;
  transparent: boolean;
  vertexColors?: boolean;
}) {
  const materialKey = [
    materialFamily.id,
    transparent ? "transparent" : "opaque",
    vertexColors ? "vertex-colors" : "solid",
    side ?? "front",
  ].join(":");
  const commonProps = {
    color,
    depthWrite,
    opacity,
    side,
    transparent,
    vertexColors,
  };

  if (materialFamily.material.kind === "basic") {
    return (
      <meshBasicMaterial
        ref={materialRef as Ref<MeshBasicMaterial>}
        key={materialKey}
        {...commonProps}
      />
    );
  }

  if (materialFamily.material.kind === "lambert") {
    return (
      <meshLambertMaterial
        ref={materialRef as Ref<MeshLambertMaterial>}
        key={materialKey}
        flatShading={materialFamily.material.flatShading}
        {...commonProps}
      />
    );
  }

  return (
    <meshStandardMaterial
      ref={materialRef as Ref<MeshStandardMaterial>}
      key={materialKey}
      flatShading={materialFamily.material.flatShading}
      metalness={materialFamily.material.metalness}
      roughness={materialFamily.material.roughness}
      {...commonProps}
    />
  );
}
