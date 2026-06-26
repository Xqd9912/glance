import {
  DEFAULT_VIEW_SCALE,
  clampViewScale,
} from "./viewState";

type Listener = () => void;

export interface CameraViewScaleCommandSnapshot {
  version: number;
  viewScale: number;
}

export interface CameraInteractionStore {
  getViewScaleCommandSnapshot: () => CameraViewScaleCommandSnapshot;
  getViewScaleSnapshot: () => number;
  requestViewScale: (viewScale: number) => void;
  setViewScaleSnapshot: (viewScale: number) => void;
  subscribeViewScale: (listener: Listener) => () => void;
  subscribeViewScaleCommand: (listener: Listener) => () => void;
}

export function createCameraInteractionStore(
  initialViewScale = DEFAULT_VIEW_SCALE,
): CameraInteractionStore {
  let viewScale = clampViewScale(initialViewScale);
  let commandSnapshot: CameraViewScaleCommandSnapshot = {
    version: 0,
    viewScale,
  };
  const viewScaleListeners = new Set<Listener>();
  const commandListeners = new Set<Listener>();

  function notify(listeners: Set<Listener>) {
    for (const listener of listeners) {
      listener();
    }
  }

  function setViewScaleSnapshot(nextViewScale: number) {
    const clampedViewScale = clampViewScale(nextViewScale);
    if (Object.is(clampedViewScale, viewScale)) {
      return;
    }

    viewScale = clampedViewScale;
    notify(viewScaleListeners);
  }

  return {
    getViewScaleCommandSnapshot: () => commandSnapshot,
    getViewScaleSnapshot: () => viewScale,
    requestViewScale: (nextViewScale: number) => {
      const clampedViewScale = clampViewScale(nextViewScale);
      setViewScaleSnapshot(clampedViewScale);
      commandSnapshot = {
        version: commandSnapshot.version + 1,
        viewScale: clampedViewScale,
      };
      notify(commandListeners);
    },
    setViewScaleSnapshot,
    subscribeViewScale: (listener: Listener) => {
      viewScaleListeners.add(listener);
      return () => viewScaleListeners.delete(listener);
    },
    subscribeViewScaleCommand: (listener: Listener) => {
      commandListeners.add(listener);
      return () => commandListeners.delete(listener);
    },
  };
}
