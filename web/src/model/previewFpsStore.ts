export interface PreviewFpsStore {
  getFpsSnapshot: () => number;
  setFpsSnapshot: (fps: number) => void;
  subscribeFps: (listener: () => void) => () => void;
}

export function createPreviewFpsStore(): PreviewFpsStore {
  let fpsSnapshot = 0;
  const listeners = new Set<() => void>();

  return {
    getFpsSnapshot: () => fpsSnapshot,
    setFpsSnapshot: (fps: number) => {
      const nextFps = Math.max(0, Math.round(Number.isFinite(fps) ? fps : 0));
      if (nextFps === fpsSnapshot) {
        return;
      }

      fpsSnapshot = nextFps;
      listeners.forEach((listener) => listener());
    },
    subscribeFps: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
