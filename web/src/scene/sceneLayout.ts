import { Box3, Vector3 } from "three";

import type { AtomRadiusModel, SceneSpec } from "../api/scene";
import type { PreviewSafeArea } from "../model/layout";
import {
  computeCrystalCameraPose,
  createDefaultCrystalCameraState,
  type CrystalCameraPose,
  type CrystalCameraState,
} from "./crystalCamera";
import { atomRadiusForModel, cellCenter, cellCorners } from "./sceneGeometry";
import {
  type CameraFitBounds,
  computeStandardCameraPose,
  type StandardCameraPose,
  type VectorTuple,
} from "./viewMath";

const NARROW_VIEWPORT_BREAKPOINT = 760;
const NARROW_VIEWPORT_SAFE_AREA: PreviewSafeArea = {
  bottom: 132,
  left: 16,
  right: 88,
  top: 476,
};

export interface SceneStructureLayout {
  cameraFitBounds: CameraFitBounds;
  groupPosition: VectorTuple;
  span: number;
  standardPose: StandardCameraPose;
}

export interface SceneLayout extends SceneStructureLayout {
  cameraPose: CrystalCameraPose;
}

export function computeSceneLayout(
  scene: SceneSpec,
  atomRadiusModel: AtomRadiusModel = "uniform",
  cameraState?: CrystalCameraState,
): SceneLayout {
  const structureLayout = computeSceneStructureLayout(scene, atomRadiusModel);
  const cameraPose = computeCrystalCameraPose(
    scene.cell.vectors,
    cameraState ?? createDefaultCrystalCameraState(),
    structureLayout.span,
  );

  return {
    ...structureLayout,
    cameraPose,
  };
}

export function computeSceneStructureLayout(
  scene: SceneSpec,
  atomRadiusModel: AtomRadiusModel = "uniform",
): SceneStructureLayout {
  const points = [
    ...cellCorners(scene.cell.vectors),
    ...scene.atoms.map((atom) => new Vector3(...atom.position)),
  ];
  const box = new Box3().setFromPoints(points);
  const maxRadius = Math.max(
    0,
    ...scene.atoms.map((atom) => atomRadiusForModel(atom, atomRadiusModel)),
  );
  box.expandByScalar(maxRadius);
  const center = cellCenter(scene.cell.vectors);
  const size = box.getSize(new Vector3());
  const span = Math.max(1, size.x, size.y, size.z);
  const standardPose = computeStandardCameraPose(scene.cell.vectors, span);
  const groupPosition: VectorTuple = [-center.x, -center.y, -center.z];
  const defaultCameraPose = computeCrystalCameraPose(
    scene.cell.vectors,
    createDefaultCrystalCameraState(),
    span,
  );

  return {
    cameraFitBounds: computeProjectedCameraFitBounds(
      scene,
      atomRadiusModel,
      groupPosition,
      defaultCameraPose,
    ),
    groupPosition,
    span,
    standardPose,
  };
}

function computeProjectedCameraFitBounds(
  scene: SceneSpec,
  atomRadiusModel: AtomRadiusModel,
  groupPosition: VectorTuple,
  cameraPose: Pick<CrystalCameraPose, "cameraUp" | "outward">,
): CameraFitBounds {
  const outward = new Vector3(...cameraPose.outward).normalize();
  const cameraUp = new Vector3(...cameraPose.cameraUp).normalize();
  const right = cameraUp.clone().cross(outward).normalize();
  const screenUp = outward.clone().cross(right).normalize();
  const offset = new Vector3(...groupPosition);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function includePoint(point: Vector3 | VectorTuple, radius = 0) {
    const localPoint = Array.isArray(point)
      ? new Vector3(...point)
      : point.clone();
    localPoint.add(offset);
    const safeRadius = Math.max(0, radius);
    const x = localPoint.dot(right);
    const y = localPoint.dot(screenUp);

    minX = Math.min(minX, x - safeRadius);
    maxX = Math.max(maxX, x + safeRadius);
    minY = Math.min(minY, y - safeRadius);
    maxY = Math.max(maxY, y + safeRadius);
  }

  for (const corner of cellCorners(scene.cell.vectors)) {
    includePoint(corner);
  }

  for (const atom of scene.atoms) {
    includePoint(atom.position, atomRadiusForModel(atom, atomRadiusModel));
  }

  return {
    projectedHeight: Math.max(1, maxY - minY),
    projectedWidth: Math.max(1, maxX - minX),
  };
}

export function previewSafeAreaForViewport(
  safeArea: PreviewSafeArea,
  viewportWidth: number,
): PreviewSafeArea {
  if (viewportWidth > NARROW_VIEWPORT_BREAKPOINT) {
    return safeArea;
  }

  return {
    bottom: Math.max(safeArea.bottom, NARROW_VIEWPORT_SAFE_AREA.bottom),
    left: NARROW_VIEWPORT_SAFE_AREA.left,
    right: NARROW_VIEWPORT_SAFE_AREA.right,
    top: Math.max(safeArea.top, NARROW_VIEWPORT_SAFE_AREA.top),
  };
}
