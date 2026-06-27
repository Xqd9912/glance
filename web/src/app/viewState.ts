import {
  applyCrystalCameraRoll,
  createDefaultCrystalCameraState,
  secondaryDirectionForPrimaryChange,
} from "../scene/crystalCamera";
import type {
  CrystalCameraPrimaryDirection,
  CrystalCameraState,
  InteractionMode,
  VectorTuple,
} from "../model";
export {
  DEFAULT_VIEW_SCALE,
  INTERACTION_MODE_OPTIONS,
  MAX_VIEW_SCALE,
  MIN_VIEW_SCALE,
  ZOOM_SLIDER_SNAP_POSITION,
  ZOOM_SLIDER_SNAP_THRESHOLD,
  clampViewScale,
  formatZoomPercent,
  parseZoomPercentInput,
  sliderPositionToViewScale,
  snapZoomSliderPosition,
  viewScaleToSliderPosition,
  type InteractionMode,
} from "../model/viewState";

export interface PreviewViewState {
  camera: CrystalCameraState;
  interactionLocked: boolean;
  interactionMode: InteractionMode;
  resetCounter: number;
  showFpsOverlay: boolean;
}

export function createPreviewViewState(): PreviewViewState {
  return {
    camera: createDefaultCrystalCameraState(),
    interactionLocked: false,
    interactionMode: "trackball",
    resetCounter: 0,
    showFpsOverlay: false,
  };
}

export function resetPreviewViewState(state: PreviewViewState): PreviewViewState {
  return {
    ...state,
    camera: createDefaultCrystalCameraState(),
    resetCounter: state.resetCounter + 1,
  };
}

export function setPreviewCameraState(
  state: PreviewViewState,
  camera: CrystalCameraState,
): PreviewViewState {
  return {
    ...state,
    camera,
  };
}

export function setPreviewCameraPrimaryDirection(
  state: PreviewViewState,
  primary: CrystalCameraPrimaryDirection,
): PreviewViewState {
  return {
    ...state,
    camera: {
      ...state.camera,
      primary,
      secondary: secondaryDirectionForPrimaryChange(
        state.camera.primary,
        state.camera.secondary,
        primary,
      ),
    },
  };
}

export function setPreviewCameraRoll(
  state: PreviewViewState,
  cellVectors: VectorTuple[],
  rollDegrees: number,
): PreviewViewState {
  return {
    ...state,
    camera: applyCrystalCameraRoll(cellVectors, state.camera, rollDegrees),
  };
}

export function setPreviewInteractionMode(
  state: PreviewViewState,
  interactionMode: InteractionMode,
): PreviewViewState {
  return {
    ...state,
    interactionMode,
  };
}

export function setPreviewInteractionLocked(
  state: PreviewViewState,
  interactionLocked: boolean,
): PreviewViewState {
  return {
    ...state,
    interactionLocked,
  };
}

export function setPreviewShowFpsOverlay(
  state: PreviewViewState,
  showFpsOverlay: boolean,
): PreviewViewState {
  return {
    ...state,
    showFpsOverlay,
  };
}
