import { memo, useEffect, useMemo } from "react";
import type { Quaternion, Vector3 } from "three";

import type { BondColorMode } from "../model";
import { BOND_RADIUS } from "./sceneGeometry";
import { twoToneBondCylinderGeometry } from "./structureGeometry";
import type { SceneMeshDetail } from "./StructureSceneObjects";
import { StructureMaterial } from "./StructureMaterial";
import type { ResolvedStructureMaterialFamily } from "./materialPresetResolver";
import type { BondRenderItem } from "./BondRenderItems";

function BondMesh({
  bondRenderItem,
  colorMode,
  materialFamily,
  meshDetail,
  opacity,
  thicknessScale,
}: {
  bondRenderItem: BondRenderItem;
  colorMode: BondColorMode;
  materialFamily: ResolvedStructureMaterialFamily;
  meshDetail: SceneMeshDetail;
  opacity: number;
  thicknessScale: number;
}) {
  const isTransparent = opacity < 1;
  const radius = BOND_RADIUS * thicknessScale;

  if (colorMode === "bicolor") {
    return (
      <TwoToneBondCylinder
        endColor={bondRenderItem.endColor}
        isTransparent={isTransparent}
        length={bondRenderItem.length}
        materialFamily={materialFamily}
        opacity={opacity}
        position={bondRenderItem.center}
        quaternion={bondRenderItem.quaternion}
        radialSegments={meshDetail.bondRadialSegments}
        radius={radius}
        startColor={bondRenderItem.startColor}
      />
    );
  }

  return (
    <BondCylinder
      color={bondRenderItem.startColor}
      isTransparent={isTransparent}
      length={bondRenderItem.length}
      materialFamily={materialFamily}
      opacity={opacity}
      position={bondRenderItem.center}
      quaternion={bondRenderItem.quaternion}
      radialSegments={meshDetail.bondRadialSegments}
      radius={radius}
    />
  );
}

function TwoToneBondCylinder({
  endColor,
  isTransparent,
  length,
  materialFamily,
  opacity,
  position,
  quaternion,
  radialSegments,
  radius,
  startColor,
}: {
  endColor: string;
  isTransparent: boolean;
  length: number;
  materialFamily: ResolvedStructureMaterialFamily;
  opacity: number;
  position: Vector3;
  quaternion: Quaternion;
  radialSegments: number;
  radius: number;
  startColor: string;
}) {
  const geometry = useMemo(
    () =>
      twoToneBondCylinderGeometry({
        endColor,
        length,
        radialSegments,
        radius,
        startColor,
      }),
    [endColor, length, radialSegments, radius, startColor],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh geometry={geometry} position={position} quaternion={quaternion}>
      <StructureMaterial
        depthWrite={!isTransparent}
        materialFamily={materialFamily}
        opacity={opacity}
        transparent={isTransparent}
        vertexColors
      />
    </mesh>
  );
}

function BondCylinder({
  color,
  isTransparent,
  length,
  materialFamily,
  opacity,
  position,
  quaternion,
  radialSegments,
  radius,
}: {
  color: string;
  isTransparent: boolean;
  length: number;
  materialFamily: ResolvedStructureMaterialFamily;
  opacity: number;
  position: Vector3;
  quaternion: Quaternion;
  radialSegments: number;
  radius: number;
}) {
  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry
        args={[
          radius,
          radius,
          length,
          radialSegments,
        ]}
      />
      <StructureMaterial
        color={color}
        depthWrite={!isTransparent}
        materialFamily={materialFamily}
        opacity={opacity}
        transparent={isTransparent}
      />
    </mesh>
  );
}

export const MemoizedBondMesh = memo(BondMesh);
