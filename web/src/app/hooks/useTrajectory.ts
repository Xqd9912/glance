import { useCallback, useEffect, useRef, useState } from "react";

import {
  isBackendUnavailablePreviewError,
  type BondAlgorithm,
  type SceneSpec,
} from "../../api/scene";
import {
  fetchTrajectoryFrame,
  updateTrajectoryTypeMap,
  uploadTrajectory,
  type TrajectoryMeta,
} from "../../api/trajectory";
import { bondCutoffsToSpecs, type BondCutoffPair } from "../../model/bondCutoffs";
import type { PreviewStatus } from "../previewState";

const CUTOFF_REFETCH_DEBOUNCE_MS = 300;
const DEFAULT_PLAYBACK_FPS = 10;
const PREFETCH_RADIUS = 3;
// How many upcoming frames to keep warm ahead of the play head, and how many
// prefetches may be in flight at once. Kept small so background prefetching
// never saturates the browser connection pool and starves the frame the user
// is actually waiting to see.
const PREFETCH_AHEAD = 6;
const PREFETCH_MAX_INFLIGHT = 3;
// Bound the client-side scene cache so long trajectories do not grow memory
// without limit; frames are cheap to refetch when evicted.
const CLIENT_CACHE_CAPACITY = 400;
const TRAJECTORY_PARSE_ERROR_MESSAGE = "This trajectory file could not be parsed.";

interface UseTrajectoryOptions {
  bondAlgorithm: BondAlgorithm;
  bondCutoffs: BondCutoffPair[];
  onFrameSceneLoaded: (scene: SceneSpec) => void;
  onTrajectoryLoaded: (scene: SceneSpec) => void;
  // Called after a dump's atom types are remapped to new elements, so callers
  // can re-seed element-dependent state (bond cutoffs, legend) from the new
  // frame's defaults.
  onElementsRemapped: (scene: SceneSpec) => void;
}

export interface TrajectoryController {
  isActive: boolean;
  meta: TrajectoryMeta | null;
  frameIndex: number;
  frameScene: SceneSpec | null;
  status: PreviewStatus;
  error: string | null;
  isPlaying: boolean;
  playbackFps: number;
  loadTrajectory: (file: File) => Promise<void>;
  clearTrajectory: () => void;
  goToFrame: (frameIndex: number) => void;
  togglePlay: () => void;
  setPlaybackFps: (fps: number) => void;
  applyTypeMap: (typeMap: Record<number, string>) => Promise<void>;
}

function settingsSignature(
  bondAlgorithm: BondAlgorithm,
  bondCutoffs: BondCutoffPair[],
): string {
  if (bondAlgorithm !== "custom-cutoff") {
    return bondAlgorithm;
  }
  const cutoffPart = bondCutoffs
    .map((pair) => `${pair.key}:${pair.distance}`)
    .join(",");
  return `custom-cutoff|${cutoffPart}`;
}

export function useTrajectory({
  bondAlgorithm,
  bondCutoffs,
  onFrameSceneLoaded,
  onTrajectoryLoaded,
  onElementsRemapped,
}: UseTrajectoryOptions): TrajectoryController {
  const [meta, setMeta] = useState<TrajectoryMeta | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [frameScene, setFrameScene] = useState<SceneSpec | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackFps, setPlaybackFps] = useState(DEFAULT_PLAYBACK_FPS);

  const cacheRef = useRef<Map<string, SceneSpec>>(new Map());
  const requestIdRef = useRef(0);
  const prefetchInflightRef = useRef(0);
  const debounceRef = useRef<number | null>(null);
  // Keep the latest settings/frame available to async callbacks without
  // re-creating them on every change.
  const bondAlgorithmRef = useRef(bondAlgorithm);
  const bondCutoffsRef = useRef(bondCutoffs);
  const frameIndexRef = useRef(0);
  const metaRef = useRef<TrajectoryMeta | null>(null);

  bondAlgorithmRef.current = bondAlgorithm;
  bondCutoffsRef.current = bondCutoffs;
  frameIndexRef.current = frameIndex;
  metaRef.current = meta;

  const isActive = meta !== null;

  const frameCacheKey = useCallback(
    (index: number) => `${index}@${settingsSignature(bondAlgorithmRef.current, bondCutoffsRef.current)}`,
    [],
  );

  const cacheFrame = useCallback((cacheKey: string, scene: SceneSpec) => {
    const cache = cacheRef.current;
    cache.delete(cacheKey);
    cache.set(cacheKey, scene);
    while (cache.size > CLIENT_CACHE_CAPACITY) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      cache.delete(oldest);
    }
  }, []);

  const requestFrame = useCallback(
    async (
      trajectoryId: string,
      index: number,
      { showLoading }: { showLoading: boolean },
    ) => {
      const cacheKey = frameCacheKey(index);
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        setFrameScene(cached);
        onFrameSceneLoaded(cached);
        return;
      }

      const requestId = (requestIdRef.current += 1);
      if (showLoading) {
        setStatus("loading");
      }

      try {
        const scene = await fetchTrajectoryFrame(trajectoryId, index, {
          bondAlgorithm: bondAlgorithmRef.current,
          cutoffs: bondCutoffsToSpecs(bondCutoffsRef.current),
        });
        cacheFrame(cacheKey, scene);
        if (requestId !== requestIdRef.current || frameIndexRef.current !== index) {
          return; // A newer request or frame change superseded this one.
        }
        setFrameScene(scene);
        onFrameSceneLoaded(scene);
        setStatus("ready");
      } catch (fetchError) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setStatus("error");
        setError(
          isBackendUnavailablePreviewError(fetchError)
            ? fetchError.message
            : TRAJECTORY_PARSE_ERROR_MESSAGE,
        );
      }
    },
    [cacheFrame, frameCacheKey, onFrameSceneLoaded],
  );

  const prefetchFrame = useCallback(
    (trajectoryId: string, index: number) => {
      const cacheKey = frameCacheKey(index);
      if (cacheRef.current.has(cacheKey) || prefetchInflightRef.current >= PREFETCH_MAX_INFLIGHT) {
        return;
      }
      prefetchInflightRef.current += 1;
      void fetchTrajectoryFrame(trajectoryId, index, {
        bondAlgorithm: bondAlgorithmRef.current,
        cutoffs: bondCutoffsToSpecs(bondCutoffsRef.current),
      })
        .then((scene) => cacheFrame(cacheKey, scene))
        .catch(() => {
          /* Prefetch failures are non-fatal. */
        })
        .finally(() => {
          prefetchInflightRef.current = Math.max(0, prefetchInflightRef.current - 1);
        });
    },
    [cacheFrame, frameCacheKey],
  );

  // Prefetch the neighborhood around a scrub target (both directions).
  const prefetchNeighbors = useCallback(
    (trajectoryId: string, index: number, frameCount: number) => {
      for (let offset = 1; offset <= PREFETCH_RADIUS; offset += 1) {
        for (const candidate of [index + offset, index - offset]) {
          if (candidate >= 0 && candidate < frameCount) {
            prefetchFrame(trajectoryId, candidate);
          }
        }
      }
    },
    [prefetchFrame],
  );

  // Keep upcoming frames warm during forward playback so the play head rarely
  // stalls waiting on the backend.
  const prefetchAhead = useCallback(
    (trajectoryId: string, index: number, frameCount: number) => {
      for (let offset = 1; offset <= PREFETCH_AHEAD; offset += 1) {
        prefetchFrame(trajectoryId, (index + offset) % frameCount);
      }
    },
    [prefetchFrame],
  );

  const clearTrajectory = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    requestIdRef.current += 1;
    cacheRef.current.clear();
    setMeta(null);
    setFrameScene(null);
    setFrameIndex(0);
    setIsPlaying(false);
    setStatus("idle");
    setError(null);
  }, []);

  const loadTrajectory = useCallback(
    async (file: File) => {
      clearTrajectory();
      setStatus("loading");
      setError(null);

      try {
        const nextMeta = await uploadTrajectory(file);
        const scene = await fetchTrajectoryFrame(nextMeta.trajectoryId, 0, {
          bondAlgorithm: bondAlgorithmRef.current,
          cutoffs: bondCutoffsToSpecs(bondCutoffsRef.current),
        });
        cacheRef.current.clear();
        cacheFrame(frameCacheKey(0), scene);
        setMeta(nextMeta);
        setFrameIndex(0);
        setFrameScene(scene);
        setStatus("ready");
        onTrajectoryLoaded(scene);
        prefetchAhead(nextMeta.trajectoryId, 0, nextMeta.frameCount);
      } catch (loadError) {
        clearTrajectory();
        setStatus("error");
        setError(
          isBackendUnavailablePreviewError(loadError)
            ? loadError.message
            : TRAJECTORY_PARSE_ERROR_MESSAGE,
        );
      }
    },
    [cacheFrame, clearTrajectory, frameCacheKey, onTrajectoryLoaded, prefetchAhead],
  );

  const goToFrame = useCallback(
    (nextIndex: number) => {
      const currentMeta = metaRef.current;
      if (!currentMeta) {
        return;
      }
      const clamped = Math.min(currentMeta.frameCount - 1, Math.max(0, nextIndex));
      setFrameIndex(clamped);
      void requestFrame(currentMeta.trajectoryId, clamped, { showLoading: true });
      prefetchNeighbors(currentMeta.trajectoryId, clamped, currentMeta.frameCount);
    },
    [prefetchNeighbors, requestFrame],
  );

  const togglePlay = useCallback(() => {
    if (!metaRef.current) {
      return;
    }
    setIsPlaying((playing) => !playing);
  }, []);

  const applyTypeMap = useCallback(
    async (typeMap: Record<number, string>) => {
      const currentMeta = metaRef.current;
      if (!currentMeta) {
        return;
      }
      setStatus("loading");
      try {
        const nextMeta = await updateTrajectoryTypeMap(currentMeta.trajectoryId, typeMap);
        cacheRef.current.clear();
        // The element set just changed, so the old cutoffs (keyed to the
        // previous elements) no longer apply. Fetch with element defaults and
        // let the caller re-seed cutoffs from the new frame's defaults.
        const index = frameIndexRef.current;
        const scene = await fetchTrajectoryFrame(nextMeta.trajectoryId, index, {
          bondAlgorithm: bondAlgorithmRef.current,
          cutoffs: [],
        });
        cacheFrame(frameCacheKey(index), scene);
        setMeta(nextMeta);
        setFrameScene(scene);
        setStatus("ready");
        onElementsRemapped(scene);
      } catch (mapError) {
        setStatus("error");
        setError(
          isBackendUnavailablePreviewError(mapError)
            ? mapError.message
            : TRAJECTORY_PARSE_ERROR_MESSAGE,
        );
      }
    },
    [cacheFrame, frameCacheKey, onElementsRemapped],
  );

  // Playback loop: only advance once the next frame is actually available, so
  // the play head never races ahead of what has been rendered. Playback then
  // runs at min(target fps, the rate the backend can supply frames).
  useEffect(() => {
    if (!isPlaying || !meta) {
      return;
    }

    let cancelled = false;
    let timer: number | null = null;

    const showFrame = async (index: number) => {
      const cacheKey = frameCacheKey(index);
      let scene = cacheRef.current.get(cacheKey);
      if (!scene) {
        try {
          scene = await fetchTrajectoryFrame(meta.trajectoryId, index, {
            bondAlgorithm: bondAlgorithmRef.current,
            cutoffs: bondCutoffsToSpecs(bondCutoffsRef.current),
          });
          cacheFrame(cacheKey, scene);
        } catch {
          return;
        }
      } else {
        cacheRef.current.delete(cacheKey);
        cacheRef.current.set(cacheKey, scene);
      }
      if (cancelled) {
        return;
      }
      setFrameScene(scene);
      setFrameIndex(index);
      onFrameSceneLoaded(scene);
    };

    const tick = async () => {
      if (cancelled) {
        return;
      }
      const startedAt = performance.now();
      const next =
        frameIndexRef.current + 1 >= meta.frameCount ? 0 : frameIndexRef.current + 1;
      // Fetch the frame we are about to show FIRST so it is never queued behind
      // background prefetches, then warm the upcoming frames.
      await showFrame(next);
      if (cancelled) {
        return;
      }
      prefetchAhead(meta.trajectoryId, next, meta.frameCount);
      const elapsed = performance.now() - startedAt;
      const wait = Math.max(0, 1000 / Math.max(1, playbackFps) - elapsed);
      timer = window.setTimeout(() => void tick(), wait);
    };

    timer = window.setTimeout(() => void tick(), 1000 / Math.max(1, playbackFps));
    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [
    cacheFrame,
    frameCacheKey,
    isPlaying,
    meta,
    onFrameSceneLoaded,
    playbackFps,
    prefetchAhead,
  ]);

  // Refetch the current frame when the unified bond settings change.
  const settingsKey = settingsSignature(bondAlgorithm, bondCutoffs);
  const previousSettingsKeyRef = useRef(settingsKey);
  useEffect(() => {
    if (!meta) {
      previousSettingsKeyRef.current = settingsKey;
      return;
    }
    if (previousSettingsKeyRef.current === settingsKey) {
      return;
    }
    previousSettingsKeyRef.current = settingsKey;
    cacheRef.current.clear();

    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void requestFrame(meta.trajectoryId, frameIndexRef.current, { showLoading: true });
      prefetchNeighbors(meta.trajectoryId, frameIndexRef.current, meta.frameCount);
    }, CUTOFF_REFETCH_DEBOUNCE_MS);
  }, [settingsKey, meta, prefetchNeighbors, requestFrame]);

  useEffect(
    () => () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  return {
    isActive,
    meta,
    frameIndex,
    frameScene,
    status,
    error,
    isPlaying,
    playbackFps,
    loadTrajectory,
    clearTrajectory,
    goToFrame,
    togglePlay,
    setPlaybackFps,
    applyTypeMap,
  };
}
