import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  BACKEND_UNAVAILABLE_MESSAGE,
  BACKEND_UNAVAILABLE_TITLE,
  DEFAULT_BOND_ALGORITHM,
  STATIC_SCENE_PREVIEW_NAME,
  defaultBondAlgorithmForScene,
  hasStaticScenePreview,
  isBackendUnavailablePreviewError,
  loadStaticScenePreview,
  uploadStructurePreview,
  type BondAlgorithm,
  type SceneSpec,
} from "../../api/scene";
import {
  bondCutoffPairsFromScene,
  bondCutoffsToSpecs,
  updateBondCutoff,
  type BondCutoffPair,
} from "../../model/bondCutoffs";
import type { PreviewStatus } from "../previewState";

const MAX_STRUCTURE_UPLOAD_BYTES = 1 * 1024 * 1024;
const STRUCTURE_FILE_TOO_LARGE_MESSAGE = "File is too large to preview.";
const STRUCTURE_PARSE_ERROR_MESSAGE = "pymatgen could not parse this file.";
const CUTOFF_REFETCH_DEBOUNCE_MS = 300;

interface ResetLoadedPreviewOptions {
  preserveActiveCommonPanelTab?: boolean;
  preserveInspectorOpen?: boolean;
}

interface UseStructurePreviewOptions {
  onBondAlgorithmSceneLoaded: (nextScene: SceneSpec) => void;
  onPreviewCleared: () => void;
  resetLoadedPreviewState: (
    nextScene: SceneSpec | null,
    options?: ResetLoadedPreviewOptions,
  ) => void;
}

export function useStructurePreview({
  onBondAlgorithmSceneLoaded,
  onPreviewCleared,
  resetLoadedPreviewState,
}: UseStructurePreviewOptions) {
  const isStaticScenePreview = hasStaticScenePreview();
  const [scene, setScene] = useState<SceneSpec | null>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>(() =>
    isStaticScenePreview ? "loading" : "idle",
  );
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [bondAlgorithm, setBondAlgorithm] =
    useState<BondAlgorithm>(DEFAULT_BOND_ALGORITHM);
  const [bondCutoffs, setBondCutoffs] = useState<BondCutoffPair[]>([]);
  const currentFileRef = useRef<File | null>(null);
  const bondAlgorithmRef = useRef<BondAlgorithm>(DEFAULT_BOND_ALGORITHM);
  const cutoffRefetchTimerRef = useRef<number | null>(null);
  const cutoffRequestIdRef = useRef(0);

  useEffect(() => {
    currentFileRef.current = currentFile;
  }, [currentFile]);

  useEffect(() => {
    bondAlgorithmRef.current = bondAlgorithm;
  }, [bondAlgorithm]);

  useEffect(
    () => () => {
      if (cutoffRefetchTimerRef.current !== null) {
        window.clearTimeout(cutoffRefetchTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isStaticScenePreview) {
      return;
    }

    let isCurrent = true;

    async function loadExampleScene() {
      try {
        const nextScene = await loadStaticScenePreview();
        if (!isCurrent || !nextScene) {
          return;
        }

        setScene(nextScene);
        setSelectedFileName(STATIC_SCENE_PREVIEW_NAME);
        setBondAlgorithm(defaultBondAlgorithmForScene(nextScene));
        setBondCutoffs(bondCutoffPairsFromScene(nextScene));
        resetLoadedPreviewState(nextScene);
        setPreviewStatus("ready");
      } catch {
        if (!isCurrent) {
          return;
        }

        setScene(null);
        onPreviewCleared();
        setSelectedFileName(null);
        setPreviewStatus("error");
        setErrorMessage("Static example could not be loaded.");
      }
    }

    void loadExampleScene();

    return () => {
      isCurrent = false;
    };
  }, [isStaticScenePreview, onPreviewCleared, resetLoadedPreviewState]);

  const loadStructureFile = useCallback(
    async (file: File) => {
      if (isStaticScenePreview) {
        setErrorMessage(BACKEND_UNAVAILABLE_MESSAGE);
        return;
      }

      if (file.size > MAX_STRUCTURE_UPLOAD_BYTES) {
        setSelectedFileName(null);
        setPreviewStatus("error");
        setErrorMessage(STRUCTURE_FILE_TOO_LARGE_MESSAGE);
        setScene(null);
        setCurrentFile(null);
        onPreviewCleared();
        return;
      }

      setSelectedFileName(file.name);
      setPreviewStatus("loading");
      setErrorMessage(null);
      setScene(null);
      setCurrentFile(file);
      setBondAlgorithm(DEFAULT_BOND_ALGORITHM);
      resetLoadedPreviewState(null);

      try {
        const nextScene = await uploadStructurePreview(file);
        setScene(nextScene);
        setBondAlgorithm(defaultBondAlgorithmForScene(nextScene));
        setBondCutoffs(bondCutoffPairsFromScene(nextScene));
        resetLoadedPreviewState(nextScene);
        setPreviewStatus("ready");
      } catch (error) {
        setScene(null);
        setCurrentFile(null);
        setSelectedFileName(null);
        onPreviewCleared();
        setPreviewStatus("error");
        setErrorMessage(
          isBackendUnavailablePreviewError(error)
            ? error.message
            : STRUCTURE_PARSE_ERROR_MESSAGE,
        );
      }
    },
    [isStaticScenePreview, onPreviewCleared, resetLoadedPreviewState],
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      await loadStructureFile(file);
    },
    [loadStructureFile],
  );

  const handleBondAlgorithmChange = useCallback(
    async (nextBondAlgorithm: BondAlgorithm) => {
      if (!currentFile) {
        if (scene) {
          setErrorMessage(BACKEND_UNAVAILABLE_MESSAGE);
        }
        return;
      }

      setPreviewStatus("loading");
      setErrorMessage(null);

      try {
        const nextScene = await uploadStructurePreview(currentFile, {
          bondAlgorithm: nextBondAlgorithm,
          cutoffs:
            nextBondAlgorithm === "custom-cutoff"
              ? bondCutoffsToSpecs(bondCutoffs)
              : undefined,
        });
        setBondAlgorithm(nextBondAlgorithm);
        setScene(nextScene);
        onBondAlgorithmSceneLoaded(nextScene);
        setPreviewStatus("ready");
      } catch (error) {
        if (isBackendUnavailablePreviewError(error)) {
          setPreviewStatus(scene ? "ready" : "error");
          setErrorMessage(error.message);
          return;
        }

        setScene(null);
        setCurrentFile(null);
        setSelectedFileName(null);
        onPreviewCleared();
        setPreviewStatus("error");
        setErrorMessage(STRUCTURE_PARSE_ERROR_MESSAGE);
      }
    },
    [bondCutoffs, currentFile, onBondAlgorithmSceneLoaded, onPreviewCleared, scene],
  );

  const runCutoffPreview = useCallback(
    async (nextPairs: BondCutoffPair[]) => {
      const file = currentFileRef.current;
      if (!file || bondAlgorithmRef.current !== "custom-cutoff") {
        return;
      }

      const requestId = (cutoffRequestIdRef.current += 1);
      setPreviewStatus("loading");
      setErrorMessage(null);

      try {
        const nextScene = await uploadStructurePreview(file, {
          bondAlgorithm: "custom-cutoff",
          cutoffs: bondCutoffsToSpecs(nextPairs),
        });
        if (requestId !== cutoffRequestIdRef.current) {
          return;
        }
        setScene(nextScene);
        onBondAlgorithmSceneLoaded(nextScene);
        setPreviewStatus("ready");
      } catch (error) {
        if (requestId !== cutoffRequestIdRef.current) {
          return;
        }
        // Keep the current scene on a failed cutoff tweak; only surface the message.
        setPreviewStatus("ready");
        setErrorMessage(
          isBackendUnavailablePreviewError(error)
            ? error.message
            : STRUCTURE_PARSE_ERROR_MESSAGE,
        );
      }
    },
    [onBondAlgorithmSceneLoaded],
  );

  const handleBondCutoffChange = useCallback(
    (key: string, distance: number) => {
      setBondCutoffs((previousPairs) => {
        const nextPairs = updateBondCutoff(previousPairs, key, distance);
        if (cutoffRefetchTimerRef.current !== null) {
          window.clearTimeout(cutoffRefetchTimerRef.current);
        }
        cutoffRefetchTimerRef.current = window.setTimeout(() => {
          cutoffRefetchTimerRef.current = null;
          void runCutoffPreview(nextPairs);
        }, CUTOFF_REFETCH_DEBOUNCE_MS);
        return nextPairs;
      });
    },
    [runCutoffPreview],
  );

  const handleResetAllSettings = useCallback(async () => {
    if (!scene || previewStatus === "loading") {
      return;
    }

    const defaultBondAlgorithm = defaultBondAlgorithmForScene(scene);

    if (cutoffRefetchTimerRef.current !== null) {
      window.clearTimeout(cutoffRefetchTimerRef.current);
      cutoffRefetchTimerRef.current = null;
    }

    if (bondAlgorithm === defaultBondAlgorithm || !currentFile) {
      setBondAlgorithm(defaultBondAlgorithm);
      setBondCutoffs(bondCutoffPairsFromScene(scene));
      setPreviewStatus("ready");
      resetLoadedPreviewState(scene, {
        preserveActiveCommonPanelTab: true,
        preserveInspectorOpen: true,
      });
      return;
    }

    setPreviewStatus("loading");
    setErrorMessage(null);

    try {
      const nextScene = await uploadStructurePreview(currentFile);
      setBondAlgorithm(defaultBondAlgorithmForScene(nextScene));
      setBondCutoffs(bondCutoffPairsFromScene(nextScene));
      setScene(nextScene);
      resetLoadedPreviewState(nextScene, {
        preserveActiveCommonPanelTab: true,
        preserveInspectorOpen: true,
      });
      setPreviewStatus("ready");
    } catch (error) {
      setPreviewStatus(scene ? "ready" : "error");
      setErrorMessage(
        isBackendUnavailablePreviewError(error)
          ? error.message
          : STRUCTURE_PARSE_ERROR_MESSAGE,
      );
    }
  }, [bondAlgorithm, currentFile, previewStatus, resetLoadedPreviewState, scene]);

  const errorTitle = useMemo(
    () =>
      errorMessage === BACKEND_UNAVAILABLE_MESSAGE
        ? BACKEND_UNAVAILABLE_TITLE
        : "Unsupported file",
    [errorMessage],
  );

  return {
    bondAlgorithm,
    bondCutoffs,
    errorMessage,
    errorTitle,
    handleBondAlgorithmChange,
    handleBondCutoffChange,
    handleFileChange,
    handleResetAllSettings,
    isStaticScenePreview,
    loadStructureFile,
    previewStatus,
    scene,
    selectedFileName,
    setBondAlgorithm,
    setBondCutoffs,
    setErrorMessage,
  };
}
