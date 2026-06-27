import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { MOUSE, OrthographicCamera, Quaternion, TOUCH, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";

import type { CameraInteractionStore } from "../model/cameraInteractionStore";
import type { PreviewSafeArea } from "../model/layout";
import {
  MAX_VIEW_SCALE,
  MIN_VIEW_SCALE,
  clampViewScale,
  type InteractionMode,
} from "../model/viewState";
import {
  computeCrystalCameraPose,
  type CrystalCameraPose,
  type CrystalCameraState,
} from "./crystalCamera";
import type { SceneLayout } from "./sceneLayout";
import { previewSafeAreaForViewport } from "./sceneLayout";
import {
  applyOrthographicFrustum,
  computeCameraFitZoom,
  computeOrthographicFrustum,
  type StandardCameraPose,
  type VectorTuple,
} from "./viewMath";

const CAMERA_TARGET = new Vector3(0, 0, 0);
const CAMERA_LOCAL_FORWARD = new Vector3(0, 0, 1);
const CAMERA_LOCAL_UP = new Vector3(0, 1, 0);
const CAMERA_COMMAND_ANIMATION_DURATION_MS = 260;
const CAMERA_CONTROLS_IDLE_EPSILON_RADIANS = 0.0005;
const CAMERA_CONTROLS_IDLE_FRAMES = 1;
const CAMERA_CONTROLS_IDLE_ZOOM_EPSILON = 0.0005;
const CAMERA_CONTROLS_STATE_NONE = -1;
const CAMERA_CONTROLS_STATE_ROTATE = 0;
const CAMERA_CONTROLS_STATE_TOUCH_ROTATE = 3;
const CAMERA_CONTROLS_STATE_ORBIT_TOUCH_DOLLY_ROTATE = 6;
const VIEW_SCALE_SYNC_EPSILON = 0.0005;
const FRUSTUM_SYNC_EPSILON = 0.000001;

type CameraControls = OrbitControls | TrackballControls;

interface CameraControlsStateSource {
  keyState?: number;
  state?: number;
}

interface CameraControlsInteractionState {
  active: boolean;
  idleFrames: number;
  lastQuaternion: Quaternion;
  lastZoom: number;
  waitingForIdle: boolean;
}

export function PreviewCameraController({
  cameraAnimatedCommandVersion,
  cameraCommandVersion,
  cameraInteractionStore,
  cameraPose,
  cellVectors,
  interactionLocked,
  interactionMode,
  layout,
  onCameraCommandAnimationActiveChange,
  onCameraControlsInteractionActiveChange,
  resetCounter,
  safeArea,
}: {
  cameraAnimatedCommandVersion: number;
  cameraCommandVersion: number;
  cameraInteractionStore: CameraInteractionStore;
  cameraPose: CrystalCameraPose;
  cellVectors: VectorTuple[];
  interactionLocked: boolean;
  interactionMode: InteractionMode;
  layout: SceneLayout;
  onCameraCommandAnimationActiveChange?: (isActive: boolean) => void;
  onCameraControlsInteractionActiveChange?: (
    isActive: boolean,
    quaternionSnapshot?: Quaternion,
  ) => void;
  resetCounter: number;
  safeArea: PreviewSafeArea;
}) {
  const { camera, gl, size } = useThree();
  const controlsRef = useRef<CameraControls | null>(null);
  const cameraAnimationRef = useRef<CameraPoseAnimation | null>(null);
  const cameraControlsInteractionRef = useRef<CameraControlsInteractionState>({
    active: false,
    idleFrames: 0,
    lastQuaternion: new Quaternion(),
    lastZoom: camera instanceof OrthographicCamera ? camera.zoom : 0,
    waitingForIdle: false,
  });
  const isCameraAnimationActiveRef = useRef(false);
  const onCameraCommandAnimationActiveChangeRef = useRef(onCameraCommandAnimationActiveChange);
  const onCameraControlsInteractionActiveChangeRef = useRef(
    onCameraControlsInteractionActiveChange,
  );
  const cameraPoseRef = useRef(cameraPose);
  const hasAppliedInitialPoseRef = useRef(false);
  const lastCameraAnimatedCommandVersionRef = useRef(cameraAnimatedCommandVersion);
  const lastCameraCommandVersionRef = useRef(cameraCommandVersion);
  const lastLayoutSpanRef = useRef(layout.span);
  const lastResetCounterRef = useRef(resetCounter);
  const syncedViewScaleRef = useRef(cameraInteractionStore.getViewScaleSnapshot());
  cameraPoseRef.current = cameraPose;
  const effectiveSafeArea = useMemo(
    () => previewSafeAreaForViewport(safeArea, size.width),
    [safeArea, size.width],
  );
  const fitZoom = useMemo(
    () => computeCameraFitZoom(layout.cameraFitBounds, size.width, size.height, effectiveSafeArea),
    [effectiveSafeArea, layout.cameraFitBounds, size.height, size.width],
  );
  onCameraCommandAnimationActiveChangeRef.current = onCameraCommandAnimationActiveChange;
  onCameraControlsInteractionActiveChangeRef.current =
    onCameraControlsInteractionActiveChange;

  const setCameraAnimationActive = useCallback(
    (isActive: boolean, forceNotify = false) => {
      if (isCameraAnimationActiveRef.current === isActive && !forceNotify) {
        return;
      }

      isCameraAnimationActiveRef.current = isActive;
      onCameraCommandAnimationActiveChangeRef.current?.(isActive);
    },
    [],
  );

  const getCameraZoomSnapshot = useCallback(
    () => (camera instanceof OrthographicCamera ? camera.zoom : 0),
    [camera],
  );

  const publishCameraViewScaleSnapshot = useCallback(
    (nextViewScale: number) => {
      if (Math.abs(nextViewScale - syncedViewScaleRef.current) < VIEW_SCALE_SYNC_EPSILON) {
        return;
      }

      syncedViewScaleRef.current = nextViewScale;
      cameraInteractionStore.setViewScaleSnapshot(nextViewScale);
    },
    [cameraInteractionStore],
  );

  const startCameraControlsInteraction = useCallback(() => {
    const interaction = cameraControlsInteractionRef.current;
    interaction.idleFrames = 0;
    interaction.lastQuaternion.copy(camera.quaternion);
    interaction.lastZoom = getCameraZoomSnapshot();
    interaction.waitingForIdle = false;

    if (interaction.active) {
      return;
    }

    interaction.active = true;
    onCameraControlsInteractionActiveChangeRef.current?.(true);
  }, [camera, getCameraZoomSnapshot]);

  const finishCameraControlsInteraction = useCallback(() => {
    const interaction = cameraControlsInteractionRef.current;
    if (!interaction.active) {
      return;
    }

    interaction.active = false;
    interaction.idleFrames = 0;
    interaction.lastQuaternion.copy(camera.quaternion);
    interaction.lastZoom = getCameraZoomSnapshot();
    interaction.waitingForIdle = false;
    onCameraControlsInteractionActiveChangeRef.current?.(
      false,
      camera.quaternion.clone(),
    );
  }, [camera, getCameraZoomSnapshot]);

  const requestCameraControlsInteractionFinish = useCallback(() => {
    const interaction = cameraControlsInteractionRef.current;
    if (!interaction.active) {
      return;
    }

    interaction.idleFrames = 0;
    interaction.lastQuaternion.copy(camera.quaternion);
    interaction.lastZoom = getCameraZoomSnapshot();
    interaction.waitingForIdle = true;
  }, [camera, getCameraZoomSnapshot]);

  const settleCameraControlsInteraction = useCallback(() => {
    const interaction = cameraControlsInteractionRef.current;
    if (!interaction.active || !interaction.waitingForIdle) {
      return;
    }

    const nextZoom = getCameraZoomSnapshot();
    const orientationDelta = interaction.lastQuaternion.angleTo(camera.quaternion);
    const zoomDelta = Math.abs(nextZoom - interaction.lastZoom);
    interaction.lastQuaternion.copy(camera.quaternion);
    interaction.lastZoom = nextZoom;

    if (
      orientationDelta > CAMERA_CONTROLS_IDLE_EPSILON_RADIANS ||
      zoomDelta > CAMERA_CONTROLS_IDLE_ZOOM_EPSILON
    ) {
      interaction.idleFrames = 0;
      return;
    }

    interaction.idleFrames += 1;
    if (interaction.idleFrames >= CAMERA_CONTROLS_IDLE_FRAMES) {
      finishCameraControlsInteraction();
    }
  }, [camera, finishCameraControlsInteraction, getCameraZoomSnapshot]);

  useLayoutEffect(() => {
    const commandChanged = cameraCommandVersion !== lastCameraCommandVersionRef.current;
    const animatedCommandChanged =
      cameraAnimatedCommandVersion !== lastCameraAnimatedCommandVersionRef.current;
    const resetChanged = resetCounter !== lastResetCounterRef.current;
    const layoutSpanChanged = Math.abs(layout.span - lastLayoutSpanRef.current) > 1e-8;
    const shouldAnimate =
      hasAppliedInitialPoseRef.current &&
      commandChanged &&
      animatedCommandChanged &&
      !resetChanged &&
      !layoutSpanChanged &&
      !prefersReducedCameraMotion();

    lastCameraCommandVersionRef.current = cameraCommandVersion;
    lastCameraAnimatedCommandVersionRef.current = cameraAnimatedCommandVersion;
    lastResetCounterRef.current = resetCounter;
    lastLayoutSpanRef.current = layout.span;
    hasAppliedInitialPoseRef.current = true;

    if (shouldAnimate) {
      cameraAnimationRef.current = createCameraPoseAnimation(camera, cameraPoseRef.current, layout.span);
      setCameraAnimationActive(true);
      return;
    }

    cameraAnimationRef.current = null;
    setCameraAnimationActive(false, commandChanged && animatedCommandChanged);
    applyStandardCameraPose(camera, cameraPoseRef.current, layout.span);
    controlsRef.current?.target.copy(CAMERA_TARGET);
    controlsRef.current?.update();
  }, [
    camera,
    cameraAnimatedCommandVersion,
    cameraCommandVersion,
    layout.span,
    resetCounter,
    setCameraAnimationActive,
  ]);

  useLayoutEffect(() => {
    const nextViewScale = cameraInteractionStore.getViewScaleSnapshot();
    syncedViewScaleRef.current = nextViewScale;

    if (!(camera instanceof OrthographicCamera)) {
      return;
    }

    syncOrthographicFrustumToZoom(
      camera,
      size.width,
      size.height,
      fitZoom * nextViewScale,
      effectiveSafeArea,
    );
  }, [
    camera,
    cameraInteractionStore,
    effectiveSafeArea,
    fitZoom,
    size.height,
    size.width,
  ]);

  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) {
      return;
    }

    return cameraInteractionStore.subscribeViewScaleCommand(() => {
      const { viewScale: commandViewScale } =
        cameraInteractionStore.getViewScaleCommandSnapshot();
      const nextViewScale = clampViewScale(commandViewScale);
      syncedViewScaleRef.current = nextViewScale;
      syncOrthographicFrustumToZoom(
        camera,
        size.width,
        size.height,
        fitZoom * nextViewScale,
        effectiveSafeArea,
      );
    });
  }, [
    camera,
    cameraInteractionStore,
    effectiveSafeArea,
    fitZoom,
    size.height,
    size.width,
  ]);

  useEffect(() => {
    return cameraInteractionStore.subscribeCameraStateCommand(() => {
      const { cameraState } = cameraInteractionStore.getCameraStateCommandSnapshot();
      if (!cameraState) {
        return;
      }

      cameraAnimationRef.current = null;
      setCameraAnimationActive(false);
      applyStandardCameraPose(
        camera,
        computeCrystalCameraPose(cellVectors, cameraState, layout.span),
        layout.span,
      );
      controlsRef.current?.target.copy(CAMERA_TARGET);
      controlsRef.current?.update();
    });
  }, [
    camera,
    cameraInteractionStore,
    cellVectors,
    layout.span,
    setCameraAnimationActive,
  ]);

  useEffect(() => {
    const controls =
      interactionMode === "trackball"
        ? new TrackballControls(camera, gl.domElement)
        : new OrbitControls(camera, gl.domElement);
    function handleControlsStart() {
      if (isCameraDirectionControlsInteraction(controls)) {
        startCameraControlsInteraction();
      }
      cameraAnimationRef.current = null;
      setCameraAnimationActive(false);
    }
    function handleControlsEnd() {
      requestCameraControlsInteractionFinish();
    }

    configureCameraControls(controls, interactionMode, interactionLocked, fitZoom);
    controls.target.copy(CAMERA_TARGET);
    resizeCameraControls(controls);
    controls.addEventListener("start", handleControlsStart);
    controls.addEventListener("end", handleControlsEnd);
    controls.update();
    controlsRef.current = controls;

    return () => {
      controls.removeEventListener("start", handleControlsStart);
      controls.removeEventListener("end", handleControlsEnd);
      finishCameraControlsInteraction();
      controls.dispose();
      if (controlsRef.current === controls) {
        controlsRef.current = null;
      }
    };
  }, [
    camera,
    finishCameraControlsInteraction,
    gl.domElement,
    interactionMode,
    requestCameraControlsInteractionFinish,
    resetCounter,
    setCameraAnimationActive,
    startCameraControlsInteraction,
  ]);

  useEffect(() => {
    return () => setCameraAnimationActive(false);
  }, [setCameraAnimationActive]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    configureCameraControls(controls, interactionMode, interactionLocked, fitZoom);
    controls.target.copy(CAMERA_TARGET);
    controls.update();
  }, [fitZoom, interactionLocked, interactionMode, resetCounter]);

  useEffect(() => {
    resizeCameraControls(controlsRef.current);
  }, [size.height, size.width]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !(camera instanceof OrthographicCamera)) {
      return;
    }
    const orthographicCamera = camera;

    function handleControlsChange() {
      const nextViewScale = syncOrthographicFrustumToCameraZoom(
        orthographicCamera,
        fitZoom,
        size.width,
        size.height,
        effectiveSafeArea,
      );

      publishCameraViewScaleSnapshot(nextViewScale);
    }

    controls.addEventListener("change", handleControlsChange);
    return () => controls.removeEventListener("change", handleControlsChange);
  }, [
    camera,
    effectiveSafeArea,
    fitZoom,
    interactionMode,
    publishCameraViewScaleSnapshot,
    resetCounter,
    size.height,
    size.width,
  ]);

  useFrame(() => {
    const animation = cameraAnimationRef.current;
    if (animation) {
      const isComplete = applyCameraPoseAnimationFrame(camera, animation, performance.now());
      if (isComplete) {
        cameraAnimationRef.current = null;
        setCameraAnimationActive(false);
      }
      controlsRef.current?.target.copy(CAMERA_TARGET);
      controlsRef.current?.update();
    } else {
      controlsRef.current?.update();
    }

    if (camera instanceof OrthographicCamera) {
      const nextViewScale = syncOrthographicFrustumToCameraZoom(
        camera,
        fitZoom,
        size.width,
        size.height,
        effectiveSafeArea,
      );
      publishCameraViewScaleSnapshot(nextViewScale);
    }

    settleCameraControlsInteraction();
  });

  return null;
}

interface CameraPoseAnimation {
  durationMs: number;
  startDistance: number;
  startQuaternion: Quaternion;
  startTimeMs: number;
  targetDistance: number;
  targetPose: CrystalCameraPose;
  targetQuaternion: Quaternion;
  targetSpan: number;
}

function createCameraPoseAnimation(
  camera: { position: Vector3; quaternion: Quaternion },
  targetPose: CrystalCameraPose,
  targetSpan: number,
): CameraPoseAnimation {
  return {
    durationMs: CAMERA_COMMAND_ANIMATION_DURATION_MS,
    startDistance: Math.max(camera.position.distanceTo(CAMERA_TARGET), 1e-6),
    startQuaternion: camera.quaternion.clone().normalize(),
    startTimeMs: performance.now(),
    targetDistance: Math.max(targetPose.distance, 1e-6),
    targetPose,
    targetQuaternion: targetPose.quaternion.clone().normalize(),
    targetSpan,
  };
}

function applyCameraPoseAnimationFrame(
  camera: {
    lookAt: (x: number, y: number, z: number) => void;
    position: Vector3;
    quaternion: Quaternion;
    up: Vector3;
  },
  animation: CameraPoseAnimation,
  nowMs: number,
): boolean {
  const progress = Math.max(
    0,
    Math.min(1, (nowMs - animation.startTimeMs) / animation.durationMs),
  );

  if (progress >= 1) {
    applyStandardCameraPose(camera, animation.targetPose, animation.targetSpan);
    return true;
  }

  const easedProgress = easeOutCubic(progress);
  const quaternion = animation.startQuaternion.clone().slerp(
    animation.targetQuaternion,
    easedProgress,
  );
  const outward = CAMERA_LOCAL_FORWARD.clone().applyQuaternion(quaternion).normalize();
  const up = CAMERA_LOCAL_UP.clone().applyQuaternion(quaternion).normalize();
  const distance =
    animation.startDistance +
    (animation.targetDistance - animation.startDistance) * easedProgress;

  camera.position.copy(outward.multiplyScalar(distance));
  camera.up.copy(up);
  camera.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z);
  return false;
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function prefersReducedCameraMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function syncOrthographicFrustumToCameraZoom(
  camera: OrthographicCamera,
  fitZoom: number,
  width: number,
  height: number,
  safeArea: PreviewSafeArea,
): number {
  const nextViewScale = clampViewScale(camera.zoom / fitZoom);
  const nextZoom = fitZoom * nextViewScale;

  syncOrthographicFrustumToZoom(camera, width, height, nextZoom, safeArea);

  return nextViewScale;
}

function syncOrthographicFrustumToZoom(
  camera: OrthographicCamera,
  width: number,
  height: number,
  zoom: number,
  safeArea: PreviewSafeArea,
) {
  const frustum = computeOrthographicFrustum(width, height, zoom, safeArea);

  if (
    Math.abs(camera.zoom - zoom) > FRUSTUM_SYNC_EPSILON ||
    Math.abs(camera.left - frustum.left) > FRUSTUM_SYNC_EPSILON ||
    Math.abs(camera.right - frustum.right) > FRUSTUM_SYNC_EPSILON ||
    Math.abs(camera.top - frustum.top) > FRUSTUM_SYNC_EPSILON ||
    Math.abs(camera.bottom - frustum.bottom) > FRUSTUM_SYNC_EPSILON
  ) {
    applyOrthographicFrustum(camera, width, height, zoom, safeArea);
  }
}

function configureCameraControls(
  controls: CameraControls,
  interactionMode: InteractionMode,
  interactionLocked: boolean,
  fitZoom: number,
) {
  controls.enabled = !interactionLocked;
  controls.minZoom = fitZoom * MIN_VIEW_SCALE;
  controls.maxZoom = fitZoom * MAX_VIEW_SCALE;

  if (interactionMode === "trackball" && controls instanceof TrackballControls) {
    controls.noPan = true;
    controls.noZoom = interactionLocked;
    controls.noRotate = interactionLocked;
    controls.mouseButtons.LEFT = MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = null;
    return;
  }

  if (interactionMode === "orbit" && controls instanceof OrbitControls) {
    controls.enableDamping = false;
    controls.enablePan = false;
    controls.enableRotate = !interactionLocked;
    controls.enableZoom = !interactionLocked;
    controls.mouseButtons.LEFT = MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = null;
    controls.touches.ONE = TOUCH.ROTATE;
    controls.touches.TWO = TOUCH.DOLLY_ROTATE;
  }
}

function resizeCameraControls(controls: CameraControls | null) {
  if (controls instanceof TrackballControls) {
    controls.handleResize();
  }
}

function isCameraDirectionControlsInteraction(controls: CameraControls): boolean {
  const stateSource = controls as CameraControlsStateSource;
  const state =
    stateSource.keyState !== undefined &&
    stateSource.keyState !== CAMERA_CONTROLS_STATE_NONE
      ? stateSource.keyState
      : stateSource.state;

  return (
    state === CAMERA_CONTROLS_STATE_ROTATE ||
    state === CAMERA_CONTROLS_STATE_TOUCH_ROTATE ||
    state === CAMERA_CONTROLS_STATE_ORBIT_TOUCH_DOLLY_ROTATE
  );
}

function applyStandardCameraPose(
  camera: { lookAt: (x: number, y: number, z: number) => void; position: Vector3; up: Vector3 },
  standardPose: StandardCameraPose,
  span: number,
) {
  camera.position.set(...standardPose.cameraPosition);
  camera.up.set(...standardPose.cameraUp);
  camera.lookAt(...standardPose.target);

  if (camera instanceof OrthographicCamera) {
    camera.near = 0.01;
    camera.far = Math.max(1000, standardPose.distance + span * 8);
    camera.updateProjectionMatrix();
  }

  camera.position.set(...standardPose.cameraPosition);
}
