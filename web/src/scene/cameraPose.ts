import { OrthographicCamera, Quaternion, Vector3 } from "three";

import type { VectorTuple } from "./viewMath";

export interface CameraPoseSnapshot {
  projection: "orthographic";
  quaternion: [number, number, number, number];
  target: VectorTuple;
}

const CAMERA_FORWARD = new Vector3(0, 0, -1);
const CAMERA_UP = new Vector3(0, 1, 0);

export function createCameraPoseSnapshot(
  orientation: Quaternion,
  target: VectorTuple = [0, 0, 0],
): CameraPoseSnapshot {
  return {
    projection: "orthographic",
    quaternion: [orientation.x, orientation.y, orientation.z, orientation.w],
    target,
  };
}

export function applyCameraPoseSnapshot(
  camera: {
    lookAt: (x: number, y: number, z: number) => void;
    position: Vector3;
    quaternion: Quaternion;
    up: Vector3;
  },
  pose: CameraPoseSnapshot,
  distance: number,
  span: number,
) {
  const quaternion = quaternionFromSnapshot(pose);
  const target = new Vector3(...pose.target);
  const forward = CAMERA_FORWARD.clone().applyQuaternion(quaternion).normalize();
  const up = CAMERA_UP.clone().applyQuaternion(quaternion).normalize();
  const cameraDistance = Math.max(4, distance);

  camera.position.copy(target).sub(forward.multiplyScalar(cameraDistance));
  camera.up.copy(up);
  camera.lookAt(...pose.target);
  camera.quaternion.copy(quaternion);

  if (camera instanceof OrthographicCamera) {
    camera.near = 0.01;
    camera.far = Math.max(1000, cameraDistance + span * 8);
    camera.updateProjectionMatrix();
  }
}

function quaternionFromSnapshot(pose: CameraPoseSnapshot): Quaternion {
  return new Quaternion(...pose.quaternion).normalize();
}
