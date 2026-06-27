import type { VectorTuple } from "./vector";

export type CrystalCameraScreenDirection = "right" | "upward" | "outward";
export type CrystalCameraPrimaryDirection = CrystalCameraScreenDirection;
export type CrystalAxisLabel = "a" | "b" | "c";

export interface CrystalCameraState {
  direct: VectorTuple;
  primary: CrystalCameraPrimaryDirection;
  reciprocal: VectorTuple;
  secondary: CrystalCameraScreenDirection;
  rollDegrees: number;
}
