import { Separator } from "@/components/ui/separator";

import type {
  CrystalCameraPrimaryDirection,
  CrystalCameraScreenDirection,
  CrystalCameraState,
  VectorTuple,
} from "../../../model";
import { PrimaryAxisRollSection } from "./orientation/PrimaryAxisRollSection";
import { VectorEditor } from "./orientation/VectorEditor";

export function OrientationTabContent({
  cameraState,
  cellVectors,
  onCameraPrimaryChange,
  onCameraRollPreviewChange,
  onCameraRollPreviewStart,
  onCameraRollChange,
  onCameraSecondaryChange,
  onCameraStateChange,
}: {
  cameraState: CrystalCameraState;
  cellVectors: VectorTuple[];
  onCameraPrimaryChange: (primary: CrystalCameraPrimaryDirection) => void;
  onCameraRollPreviewChange: (rollDegrees: number) => void;
  onCameraRollPreviewStart: () => void;
  onCameraRollChange: (rollDegrees: number) => void;
  onCameraSecondaryChange: (secondary: CrystalCameraScreenDirection) => void;
  onCameraStateChange: (cameraState: CrystalCameraState) => void;
}) {
  return (
    <div className="flex flex-col" data-camera-tab-keepalive="">
      <PrimaryAxisRollSection
        primary={cameraState.primary}
        rollDegrees={cameraState.rollDegrees}
        onCameraPrimaryChange={onCameraPrimaryChange}
        onCameraRollChange={onCameraRollChange}
        onCameraRollPreviewChange={onCameraRollPreviewChange}
        onCameraRollPreviewStart={onCameraRollPreviewStart}
      />

      <Separator />

      <VectorEditor
        cameraState={cameraState}
        cellVectors={cellVectors}
        onCameraSecondaryChange={onCameraSecondaryChange}
        onCameraStateChange={onCameraStateChange}
      />
    </div>
  );
}
