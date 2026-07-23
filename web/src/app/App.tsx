import { AlertTriangleIcon, FolderOpen, ImageDown, RefreshCw, RotateCcw, Zap } from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { AtomInspectorCard } from "./AtomInspectorCard";
import { MeasurementInfoCard } from "./MeasurementInfoCard";
import type { AtomSpec, SceneSpec } from "../api/scene";
import type { IsosurfaceOverlay } from "../scene/DensityIsosurface";
import { TOOL_ICON_BUTTON_ACTIVE_CLASS, TOOL_ICON_BUTTON_CLASS } from "./surface";
import { inspectedAtomInfoForId } from "./atomInspector";
import { LatticeScene } from "../scene/LatticeScene";
import { ATOM_HIGHLIGHT_PULSE_MS } from "../scene/atomHighlight";
import { selectedSiteIndicesForHighlight } from "../scene/atomPicking";
import { OrientationGizmo } from "../scene/OrientationGizmo";
import {
  CommonControlsPanel,
  type CommonPanelTab,
} from "./controls/CommonControlsPanel";
import { ViewControlRail } from "./controls/ViewControlRail";
import { createCameraInteractionStore } from "./cameraInteractionStore";
import { createPreviewFpsStore } from "../model/previewFpsStore";
import { deriveElementLegendEntries } from "./elementLegend";
import { useFigureExportController } from "./hooks/useFigureExportController";
import { useAtomSelection } from "./hooks/useAtomSelection";
import { useLockedInteractionFeedback } from "./hooks/useLockedInteractionFeedback";
import { usePreviewCameraCommands } from "./hooks/usePreviewCameraCommands";
import { useStructurePreview } from "./hooks/useStructurePreview";
import { useTrajectory } from "./hooks/useTrajectory";
import {
  fetchTrajectoryAtomProperties,
  isTrajectoryFileName,
  type AtomPropertySeries,
} from "../api/trajectory";
import {
  bondCutoffPairsFromScene,
  bondCutoffsToSpecs,
  updateBondCutoff,
} from "../model/bondCutoffs";
import { TrajectoryPlayer } from "./trajectory/TrajectoryPlayer";
import { AnalysisPanel } from "./analysis/AnalysisPanel";
import { ElectronicPanel } from "./electronic/ElectronicPanel";
import { ElementLegend } from "./legend/ElementLegend";
import { ScalarLegend } from "./legend/ScalarLegend";
import { useViewportSize } from "./layout/overlayLayout";
import { StructureSummaryCard } from "./panels/StructureSummaryCard";
import {
  InspectorSidebar,
  InspectorToggle,
} from "./inspector/InspectorSidebar";
import {
  createDefaultComponentOpacity,
  createDefaultComponentVisibility,
  createDefaultPeriodicCellRange,
  createDefaultStyle,
  baseColorSchemeForStyle,
  DEFAULT_SHOW_CRYSTAL_AXIS_LABELS,
  DEFAULT_UNIT_CELL_LINE_STYLE,
  createCustomColormapFromScheme,
  defaultPreviewMeshQualityForScene,
  elementColorOverridesForStyle,
  type MeshQuality,
  type UnitCellLineStyle,
  hasPolyhedra,
  previewSafeAreaForInspector,
  leftPanelSceneOffsetX,
  rightPanelsSceneOffsetX,
  electronicPanelRightOffset,
  ANALYSIS_PANEL_DEFAULT_WIDTH_PX,
  canonicalSites,
  atomPropertyOptions,
  createDefaultAtomPropertyControlState,
  ELECTRONIC_PANEL_DEFAULT_WIDTH_PX,
  INSPECTOR_PANEL_DEFAULT_WIDTH_PX,
  isolateSelectedSites,
  isDefaultPeriodicCellRange,
  isSiteVisible,
  replicateSceneForPeriodicRange,
  validatePeriodicReplicationBudget,
  visibleSceneForComponents,
  visibleSceneForSites,
  type PeriodicCellRange,
  matchingSiteIndices,
  finitePropertyDomain,
  scalarSiteColors,
  scalarPropertyDomain,
  staticSceneAtomProperties,
  type AtomPropertyControlState,
  type ScalarPropertySnapshot,
  type ScalarLegendSpec,
  appendMeasurementPoint,
  atomInstanceIdentity,
  type AtomInstanceIdentity,
  type MeasurementRecord,
  type MeasurementTool,
  type DisplayPresetSnapshot,
} from "../model";

interface ResetLoadedPreviewOptions {
  preserveActiveCommonPanelTab?: boolean;
  preserveInspectorOpen?: boolean;
}

type ResetLoadedPreviewState = (
  nextScene: SceneSpec | null,
  options?: ResetLoadedPreviewOptions,
) => void;

export function App() {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [componentVisibility, setComponentVisibility] = useState(
    createDefaultComponentVisibility,
  );
  const [componentOpacity, setComponentOpacity] = useState(createDefaultComponentOpacity);
  const [style, setStyle] = useState(createDefaultStyle);
  const [previewMeshQuality, setPreviewMeshQuality] = useState<MeshQuality>(
    () => defaultPreviewMeshQualityForScene(null),
  );
  const [unitCellLineStyle, setUnitCellLineStyle] = useState<UnitCellLineStyle>(
    DEFAULT_UNIT_CELL_LINE_STYLE,
  );
  const [showCrystalAxisLabels, setShowCrystalAxisLabels] = useState(
    DEFAULT_SHOW_CRYSTAL_AXIS_LABELS,
  );
  const [inspectedAtomId, setInspectedAtomId] = useState<string | null>(null);
  const [pulseAtom, setPulseAtom] = useState<{ atomId: string; token: number } | null>(null);
  const [activeCommonPanelTab, setActiveCommonPanelTab] =
    useState<CommonPanelTab>("display");
  const [periodicCellRange, setPeriodicCellRange] = useState<PeriodicCellRange>(
    createDefaultPeriodicCellRange,
  );
  const [periodicNotice, setPeriodicNotice] = useState<string | null>(null);
  const resetPeriodicDisplay = useCallback(() => {
    setPeriodicCellRange(createDefaultPeriodicCellRange());
    setPeriodicNotice(null);
  }, []);
  const {
    applySelectedSites,
    clearAppliedSelection,
    handleClearSelection,
    handleElementVisibilityToggle,
    handleHideSelected,
    handleInvertSelection,
    handleSelectedOnlyChange,
    handleShowAll,
    handleSiteSelectionToggle,
    handleSiteVisibilityToggle,
    reconcileAtomSelection,
    replaceSiteSelection,
    resetAtomSelection,
    selectedSiteIndices,
    selectedOnly,
    sessionVersion: atomSelectionSessionVersion,
    siteVisibility,
  } = useAtomSelection();
  const [propertyState, setPropertyState] = useState<AtomPropertyControlState>(
    createDefaultAtomPropertyControlState,
  );
  const [trajectoryProperties, setTrajectoryProperties] = useState<
    Record<string, ScalarPropertySnapshot>
  >({});
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const propertyRequestVersionRef = useRef(0);
  const [iprColorProperty, setIprColorProperty] = useState<ScalarPropertySnapshot | null>(null);
  const resetAtomProperties = useCallback(() => {
    setPropertyState(createDefaultAtomPropertyControlState());
    setTrajectoryProperties({});
    setPropertyLoading(false);
    setPropertyError(null);
    setIprColorProperty(null);
  }, []);
  const [measurementTool, setMeasurementTool] = useState<MeasurementTool | null>(null);
  const [measurementDraft, setMeasurementDraftState] = useState<AtomInstanceIdentity[]>([]);
  const measurementDraftRef = useRef<AtomInstanceIdentity[]>([]);
  const replaceMeasurementDraft = useCallback((next: AtomInstanceIdentity[]) => {
    measurementDraftRef.current = next;
    setMeasurementDraftState(next);
  }, []);
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([]);
  const resetMeasurements = useCallback(() => {
    setMeasurementTool(null);
    replaceMeasurementDraft([]);
    setMeasurements([]);
  }, [replaceMeasurementDraft]);
  const [cameraInteractionStore] = useState(createCameraInteractionStore);
  const [previewFpsStore] = useState(createPreviewFpsStore);
  const [isStructureSummaryCollapsed, setIsStructureSummaryCollapsed] = useState(true);
  const viewportSize = useViewportSize();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inspectedAtomIdRef = useRef<string | null>(null);
  const resetLoadedPreviewStateRef = useRef<ResetLoadedPreviewState>(() => {});
  const resetLoadedPreviewStateForPreview = useCallback<ResetLoadedPreviewState>(
    (nextScene, options) => {
      resetLoadedPreviewStateRef.current(nextScene, options);
    },
    [],
  );
  const handlePreviewCleared = useCallback(() => {
    setInspectedAtomId(null);
    setPulseAtom(null);
    setIsInspectorOpen(false);
    setIsStructureSummaryCollapsed(true);
    resetAtomSelection();
    resetPeriodicDisplay();
    resetAtomProperties();
    resetMeasurements();
  }, [resetAtomProperties, resetAtomSelection, resetMeasurements, resetPeriodicDisplay]);
  const handleBondAlgorithmSceneLoaded = useCallback((nextScene: SceneSpec) => {
    setInspectedAtomId(null);
    setPulseAtom(null);
    setPreviewMeshQuality(defaultPreviewMeshQualityForScene(nextScene));
    setUnitCellLineStyle(DEFAULT_UNIT_CELL_LINE_STYLE);
    setShowCrystalAxisLabels(DEFAULT_SHOW_CRYSTAL_AXIS_LABELS);
  }, []);
  const {
    bondAlgorithm,
    bondCutoffs,
    errorMessage: structureErrorMessage,
    errorTitle: structureErrorTitle,
    handleBondAlgorithmChange,
    handleBondCutoffChange,
    handleResetAllSettings,
    loadStructureFile,
    previewStatus: structurePreviewStatus,
    scene: structureScene,
    selectedFileName,
    setBondAlgorithm,
    setBondCutoffs,
    setErrorMessage,
  } = useStructurePreview({
    onBondAlgorithmSceneLoaded: handleBondAlgorithmSceneLoaded,
    onPreviewCleared: handlePreviewCleared,
    resetLoadedPreviewState: resetLoadedPreviewStateForPreview,
  });

  const [trajectoryFileName, setTrajectoryFileName] = useState<string | null>(null);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isElectronicOpen, setIsElectronicOpen] = useState(false);
  const [electronicPanelWidth, setElectronicPanelWidth] = useState(
    ELECTRONIC_PANEL_DEFAULT_WIDTH_PX,
  );
  const [inspectorPanelWidth, setInspectorPanelWidth] = useState(
    INSPECTOR_PANEL_DEFAULT_WIDTH_PX,
  );
  const [analysisPanelWidth, setAnalysisPanelWidth] = useState(
    ANALYSIS_PANEL_DEFAULT_WIDTH_PX,
  );
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);
  const [iprScene, setIprScene] = useState<SceneSpec | null>(null);
  const [iprFileName, setIprFileName] = useState<string | null>(null);
  const [iprSessionVersion, setIprSessionVersion] = useState(0);
  const [densityScene, setDensityScene] = useState<SceneSpec | null>(null);
  const [densityFileName, setDensityFileName] = useState<string | null>(null);
  const [densityIsosurface, setDensityIsosurface] = useState<IsosurfaceOverlay | null>(null);
  const clearIprSession = useCallback(() => {
    setIprScene(null);
    setIprFileName(null);
    setIprSessionVersion((version) => version + 1);
  }, []);
  const handleFrameSceneLoaded = useCallback(() => {}, []);
  const handleTrajectoryLoaded = useCallback(
    (nextScene: SceneSpec) => {
      resetLoadedPreviewStateForPreview(nextScene);
      // Seed the per-pair cutoff editor from the covalent-radii defaults the
      // first frame reports. Bonding is already on "custom-cutoff" (set before
      // loading) because it rebuilds ~60x faster per frame than CrystalNN, so
      // playback keeps up, and matches the "one cutoff for all frames" workflow.
      setBondCutoffs(bondCutoffPairsFromScene(nextScene));
    },
    [resetLoadedPreviewStateForPreview, setBondCutoffs],
  );
  const handleElementsRemapped = useCallback(
    (nextScene: SceneSpec) => {
      // Atom types were remapped to new elements; re-seed the per-pair cutoffs
      // (and thus the legend/editor) from the new frame's covalent defaults.
      setBondCutoffs(bondCutoffPairsFromScene(nextScene));
    },
    [setBondCutoffs],
  );
  const trajectory = useTrajectory({
    bondAlgorithm,
    bondCutoffs,
    onFrameSceneLoaded: handleFrameSceneLoaded,
    onTrajectoryLoaded: handleTrajectoryLoaded,
    onElementsRemapped: handleElementsRemapped,
  });

  const handleDensitySceneChange = useCallback(
    (next: { scene: SceneSpec; fileName: string } | null) => {
      if (next) {
        clearIprSession();
        setDensityScene(next.scene);
        setDensityFileName(next.fileName);
        resetPeriodicDisplay();
        resetLoadedPreviewStateForPreview(next.scene);
      } else {
        setDensityScene(null);
        setDensityFileName(null);
        setDensityIsosurface(null);
        resetAtomSelection();
        resetMeasurements();
      }
    },
    [
      clearIprSession,
      resetAtomSelection,
      resetMeasurements,
      resetLoadedPreviewStateForPreview,
      resetPeriodicDisplay,
    ],
  );
  const handleIsosurfaceChange = useCallback((overlay: IsosurfaceOverlay | null) => {
    setDensityIsosurface(overlay);
  }, []);

  const handleIprSceneLoad = useCallback(
    (next: { scene: SceneSpec; fileName: string }) => {
      setDensityScene(null);
      setDensityFileName(null);
      setDensityIsosurface(null);
      trajectory.clearTrajectory();
      setTrajectoryFileName(null);
      setIsAnalysisOpen(false);
      setIprScene(next.scene);
      setIprFileName(next.fileName);
      setBondAlgorithm("custom-cutoff");
      setBondCutoffs(bondCutoffPairsFromScene(next.scene));
      resetLoadedPreviewStateForPreview(next.scene);
    },
    [
      resetLoadedPreviewStateForPreview,
      setBondAlgorithm,
      setBondCutoffs,
      trajectory,
    ],
  );
  const handleIprApply = useCallback(
    (siteIndices: readonly number[]) => {
      applySelectedSites(siteIndices);
      setActiveCommonPanelTab("select");
    },
    [applySelectedSites],
  );
  const handleIprClear = useCallback(() => {
    clearAppliedSelection();
  }, [clearAppliedSelection]);

  const trajectoryActive = trajectory.isActive;
  // A loaded CHGCAR density (structure + electron-cloud isosurface) takes over
  // the main viewport, reusing the structure renderer.
  const densityActive = densityScene !== null;
  const iprActive = iprScene !== null;
  const scene = densityActive
    ? densityScene
    : iprActive
      ? iprScene
      : trajectoryActive
        ? trajectory.frameScene
        : structureScene;
  // A trajectory reports "loading" from the moment upload starts, but it only becomes
  // "active" once its metadata arrives. Parsing a large trajectory is the slowest step, so
  // surface that loading state during the gap too — otherwise the preview shows nothing
  // happening while the file is being read.
  const trajectoryLoading = trajectory.status === "loading";
  const previewStatus = densityActive
    ? "ready"
    : iprActive
      ? "ready"
      : trajectoryActive
        ? trajectory.status
        : trajectoryLoading
          ? "loading"
          : structurePreviewStatus;
  const loadingLabel = trajectoryLoading ? "Loading trajectory…" : "Loading structure…";
  const errorMessage = trajectoryActive
    ? trajectory.error
    : structureErrorMessage;
  const errorTitle =
    trajectoryActive && trajectory.error ? "Unsupported file" : structureErrorTitle;
  const displayFileName = densityActive
    ? densityFileName
    : iprActive
      ? iprFileName
      : trajectoryActive
        ? trajectoryFileName
        : selectedFileName;

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      // Opening a structure/trajectory dismisses any active CHGCAR density view
      // and closes the electronic panel so it does not linger over the new file.
      clearIprSession();
      handleDensitySceneChange(null);
      setIsElectronicOpen(false);
      if (isTrajectoryFileName(file.name)) {
        setTrajectoryFileName(file.name);
        // Switch to fast cutoff bonding before loading so frame 0 (and every
        // frame) is built with the ~60x faster custom-cutoff path rather than
        // CrystalNN; cutoffs are seeded from the first frame's defaults.
        setBondAlgorithm("custom-cutoff");
        setBondCutoffs([]);
        await trajectory.loadTrajectory(file);
      } else {
        trajectory.clearTrajectory();
        setTrajectoryFileName(null);
        await loadStructureFile(file);
      }
    },
    [
      handleDensitySceneChange,
      clearIprSession,
      loadStructureFile,
      setBondAlgorithm,
      setBondCutoffs,
      setIsElectronicOpen,
      trajectory,
    ],
  );

  const handleUnifiedBondAlgorithmChange = useCallback(
    (nextBondAlgorithm: typeof bondAlgorithm) => {
      if (trajectoryActive) {
        setBondAlgorithm(nextBondAlgorithm);
      } else {
        void handleBondAlgorithmChange(nextBondAlgorithm);
      }
    },
    [handleBondAlgorithmChange, setBondAlgorithm, trajectoryActive],
  );

  const handleUnifiedBondCutoffChange = useCallback(
    (key: string, distance: number) => {
      if (trajectoryActive) {
        setBondCutoffs((previous) => updateBondCutoff(previous, key, distance));
      } else {
        handleBondCutoffChange(key, distance);
      }
    },
    [handleBondCutoffChange, setBondCutoffs, trajectoryActive],
  );

  const periodicDisabledReason = densityActive
    ? "Cell repetition is unavailable while a density isosurface is active."
    : !scene
      ? "Load a periodic structure before repeating cells."
      : !scene.cell.periodic
        ? "Cell repetition is unavailable for non-periodic structures."
        : null;
  const handlePeriodicCellRangeChange = useCallback(
    (nextRange: PeriodicCellRange): string | null => {
      if (!scene) {
        return "Load a periodic structure before repeating cells.";
      }
      if (densityActive) {
        return "Cell repetition is unavailable while a density isosurface is active.";
      }
      const validation = validatePeriodicReplicationBudget(scene, nextRange);
      if (!validation.valid) {
        return validation.message;
      }
      setPeriodicNotice(null);
      setPeriodicCellRange(nextRange);
      return null;
    },
    [densityActive, scene],
  );
  const handlePeriodicCellRangeReset = useCallback(() => {
    resetPeriodicDisplay();
  }, [resetPeriodicDisplay]);

  useEffect(() => {
    if (isDefaultPeriodicCellRange(periodicCellRange)) {
      return;
    }
    if (!scene || densityActive) {
      setPeriodicCellRange(createDefaultPeriodicCellRange());
      setPeriodicNotice(
        densityActive
          ? "Cell range was reset because density views cannot be repeated."
          : null,
      );
      return;
    }
    const validation = validatePeriodicReplicationBudget(scene, periodicCellRange);
    if (!validation.valid) {
      setPeriodicCellRange(createDefaultPeriodicCellRange());
      setPeriodicNotice(`Cell range was reset: ${validation.message}`);
    }
  }, [densityActive, periodicCellRange, scene]);

  const effectivePeriodicCellRange = useMemo(() => {
    if (!scene || densityActive) {
      return createDefaultPeriodicCellRange();
    }
    return validatePeriodicReplicationBudget(scene, periodicCellRange).valid
      ? periodicCellRange
      : createDefaultPeriodicCellRange();
  }, [densityActive, periodicCellRange, scene]);

  const canonicalAtoms = useMemo(() => canonicalSites(scene), [scene]);
  const propertyOptions = useMemo(
    () => atomPropertyOptions(
      [...new Set(canonicalAtoms.map((atom) => atom.element))],
      trajectoryActive,
    ),
    [canonicalAtoms, trajectoryActive],
  );
  const propertyColorOptions = useMemo(
    () => [
      ...propertyOptions,
      ...(iprColorProperty ? [{ id: iprColorProperty.propertyId, label: iprColorProperty.label }] : []),
    ],
    [iprColorProperty, propertyOptions],
  );
  const requestedPropertyIds = useMemo(
    () => [...new Set([
      ...(propertyState.colorPropertyId && propertyState.colorPropertyId !== "ipr.selected"
        ? [propertyState.colorPropertyId]
        : []),
      ...(propertyState.filterEnabled
        ? propertyState.conditions.map((condition) => condition.propertyId)
        : []),
    ])],
    [propertyState],
  );
  const staticProperties = useMemo(
    () => !trajectoryActive && scene
      ? staticSceneAtomProperties(scene, requestedPropertyIds)
      : {},
    [requestedPropertyIds, scene, trajectoryActive],
  );

  useEffect(() => {
    const requestVersion = propertyRequestVersionRef.current + 1;
    propertyRequestVersionRef.current = requestVersion;
    if (!trajectory.meta || requestedPropertyIds.length === 0) {
      setTrajectoryProperties({});
      setPropertyLoading(false);
      setPropertyError(null);
      return;
    }
    const controller = new AbortController();
    const requestedFrame = trajectory.frameIndex;
    setPropertyLoading(true);
    setPropertyError(null);
    void fetchTrajectoryAtomProperties(
      trajectory.meta.trajectoryId,
      requestedFrame,
      requestedPropertyIds,
      {
        bondAlgorithm,
        cutoffs: bondCutoffsToSpecs(bondCutoffs),
      },
      controller.signal,
    ).then((response) => {
      if (
        propertyRequestVersionRef.current !== requestVersion
        || response.frameIndex !== requestedFrame
      ) {
        return;
      }
      setTrajectoryProperties(response.properties);
      const unavailable = requestedPropertyIds
        .map((propertyId) => response.unavailable[propertyId])
        .filter((message): message is string => Boolean(message));
      setPropertyError(unavailable[0] ?? null);
      setPropertyLoading(false);
    }).catch((caught) => {
      if (caught instanceof Error && caught.name === "AbortError") {
        return;
      }
      setTrajectoryProperties({});
      setPropertyLoading(false);
      setPropertyError(caught instanceof Error ? caught.message : "Atom properties failed.");
    });
    return () => controller.abort();
  }, [
    bondAlgorithm,
    bondCutoffs,
    requestedPropertyIds,
    trajectory.frameIndex,
    trajectory.meta,
  ]);

  const availableProperties = useMemo<Record<string, ScalarPropertySnapshot>>(
    () => ({
      ...(trajectoryActive ? trajectoryProperties : staticProperties),
      ...(iprColorProperty ? { [iprColorProperty.propertyId]: iprColorProperty } : {}),
    }),
    [iprColorProperty, staticProperties, trajectoryActive, trajectoryProperties],
  );
  const propertyMatches = useMemo(
    () => propertyState.filterEnabled
      ? matchingSiteIndices(
          availableProperties,
          propertyState.conditions,
          propertyState.filterLogic,
        )
      : null,
    [availableProperties, propertyState],
  );
  const scalarColors = useMemo(() => {
    const propertyId = propertyState.colorPropertyId;
    const snapshot = propertyId ? availableProperties[propertyId] : undefined;
    return snapshot
      ? scalarSiteColors(snapshot, propertyState.palette, propertyState.manualDomain)
      : undefined;
  }, [availableProperties, propertyState]);
  const scalarLegend = useMemo<ScalarLegendSpec | null>(() => {
    const propertyId = propertyState.colorPropertyId;
    const snapshot = propertyId ? availableProperties[propertyId] : undefined;
    const domain = snapshot
      ? scalarPropertyDomain(snapshot, propertyState.manualDomain)
      : undefined;
    return snapshot && domain
      ? { label: snapshot.label, unit: snapshot.unit, domain, palette: propertyState.palette }
      : null;
  }, [availableProperties, propertyState]);
  const handleSelectPropertyMatches = useCallback(() => {
    if (propertyMatches) {
      replaceSiteSelection(propertyMatches);
      setActiveCommonPanelTab("select");
    }
  }, [propertyMatches, replaceSiteSelection]);
  const handleIprColor = useCallback((values: ReadonlyMap<number, number> | null) => {
    if (!values || !scene) {
      setIprColorProperty(null);
      setPropertyState((current) => current.colorPropertyId === "ipr.selected"
        ? { ...current, colorPropertyId: null, manualDomain: null }
        : current);
      return;
    }
    const rows = Array.from(
      { length: scene.summary.atomCount },
      (_, siteIndex) => values.get(siteIndex) ?? null,
    );
    setIprColorProperty({
      propertyId: "ipr.selected",
      label: "IPR composition",
      unit: "",
      values: rows,
      domain: finitePropertyDomain(rows),
    });
    setPropertyState((current) => ({
      ...current,
      colorPropertyId: "ipr.selected",
      manualDomain: null,
    }));
  }, [scene]);
  const handleCommonPanelTabChange = useCallback((tab: CommonPanelTab) => {
    setActiveCommonPanelTab(tab);
    if (tab === "select") {
      setMeasurementTool(null);
      replaceMeasurementDraft([]);
      setMeasurements([]);
    }
  }, [replaceMeasurementDraft]);
  const handleMeasurementToolChange = useCallback((tool: MeasurementTool | null) => {
    setMeasurementTool(tool);
    replaceMeasurementDraft([]);
    setMeasurements([]);
    setInspectedAtomId(null);
    if (tool !== null) {
      setActiveCommonPanelTab("display");
    }
  }, [replaceMeasurementDraft]);
  const handleAtomMeasurementPick = useCallback((atom: AtomSpec) => {
    if (!measurementTool || measurementTool === "bond") {
      return;
    }
    if (measurementDraftRef.current.length === 0) {
      setMeasurements([]);
    }
    const result = appendMeasurementPoint(
      measurementDraftRef.current,
      atomInstanceIdentity(atom),
      measurementTool,
    );
    replaceMeasurementDraft(result.draft);
    if (result.completed) {
      // Keep this side effect outside a React state updater. Development
      // StrictMode may invoke updater functions more than once.
      setMeasurements([result.completed]);
    }
  }, [measurementTool, replaceMeasurementDraft]);
  const handleBondMeasurementPick = useCallback((start: AtomSpec, end: AtomSpec) => {
    if (measurementTool !== "bond") {
      return;
    }
    setMeasurements([{
      id: crypto.randomUUID(),
      type: "bond",
      points: [atomInstanceIdentity(start), atomInstanceIdentity(end)],
    }]);
  }, [measurementTool]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && measurementDraft.length > 0) {
        replaceMeasurementDraft([]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [measurementDraft.length, replaceMeasurementDraft]);
  const effectiveSiteVisibility = useMemo(
    () =>
      selectedOnly
        ? isolateSelectedSites(
            new Set(
              Array.from(selectedSiteIndices).filter((siteIndex) =>
                isSiteVisible(siteVisibility, siteIndex),
              ),
            ),
          )
        : siteVisibility,
    [selectedOnly, selectedSiteIndices, siteVisibility],
  );
  const siteFilteredScene = useMemo(
    () => visibleSceneForSites(scene, effectiveSiteVisibility),
    [effectiveSiteVisibility, scene],
  );
  const propertyFilteredScene = useMemo(
    () => propertyState.filterEnabled
      && propertyState.conditions.length > 0
      && propertyMatches !== null
      ? visibleSceneForSites(siteFilteredScene, isolateSelectedSites(propertyMatches))
      : siteFilteredScene,
    [propertyMatches, propertyState.conditions.length, propertyState.filterEnabled, siteFilteredScene],
  );
  const visibleCanonicalSiteIndices = useMemo(
    () =>
      new Set(
        canonicalAtoms
          .filter((atom) =>
            isSiteVisible(effectiveSiteVisibility, atom.siteIndex)
            && (!propertyState.filterEnabled
              || propertyState.conditions.length === 0
              || propertyMatches === null
              || propertyMatches.has(atom.siteIndex)),
          )
          .map((atom) => atom.siteIndex),
      ),
    [
      canonicalAtoms,
      effectiveSiteVisibility,
      propertyMatches,
      propertyState.conditions.length,
      propertyState.filterEnabled,
    ],
  );
  const repeatedSiteFilteredScene = useMemo(
    () => replicateSceneForPeriodicRange(propertyFilteredScene, effectivePeriodicCellRange),
    [effectivePeriodicCellRange, propertyFilteredScene],
  );
  const visibleScene = useMemo(
    () => visibleSceneForComponents(repeatedSiteFilteredScene, componentVisibility),
    [componentVisibility, repeatedSiteFilteredScene],
  );
  const handleIsSiteVisible = useCallback(
    (siteIndex: number) => isSiteVisible(effectiveSiteVisibility, siteIndex),
    [effectiveSiteVisibility],
  );
  const handleIsSiteBaseVisible = useCallback(
    (siteIndex: number) => isSiteVisible(siteVisibility, siteIndex),
    [siteVisibility],
  );
  const handleSelectElementVisibilityToggle = useCallback(
    (element: string) => handleElementVisibilityToggle(scene, element),
    [handleElementVisibilityToggle, scene],
  );
  const handleSelectInvertSelection = useCallback(
    () => handleInvertSelection(scene),
    [handleInvertSelection, scene],
  );
  const inspectedAtomInfo = useMemo(
    () => inspectedAtomInfoForId(visibleScene, inspectedAtomId),
    [inspectedAtomId, visibleScene],
  );
  const hasVisibleScene = visibleScene !== null;
  const {
    cameraAnimatedCommandVersion,
    cameraCommandVersion,
    cameraControlsPanelState,
    cameraOrientationRef,
    cameraOrientationVersion,
    handleCameraCommandAnimationActiveChange,
    handleCameraControlsInteractionActiveChange,
    handleCameraOrientationChange,
    handleCameraPrimaryChange,
    handleCameraRollChange,
    handleCameraRollPreviewChange,
    handleCameraRollPreviewStart,
    handleCameraSecondaryChange,
    handleCameraStateChange,
    handleDragSensitivityChange,
    handleGizmoAxisClick,
    handleInteractionLockedChange,
    handleInteractionModeChange,
    handleLightStrengthChange,
    handleResetView,
    handleShowFpsOverlayChange,
    isCameraCommandAnimationActive,
    isCameraControlsInteractionActive,
    isCameraRollInteractionActive,
    orientationGizmoFrameRequestRef,
    requestOrientationGizmoFrame,
    resetCameraForScene,
    viewState,
  } = usePreviewCameraCommands({
    cameraInteractionStore,
    previewFpsStore,
    scene,
    visibleScene,
  });
  const getDisplayPresetSnapshot = useCallback((): DisplayPresetSnapshot => ({
    componentOpacity: structuredClone(componentOpacity),
    componentVisibility: structuredClone(componentVisibility),
    periodicCellRange: structuredClone(effectivePeriodicCellRange),
    cameraState: structuredClone(cameraControlsPanelState),
    viewScale: cameraInteractionStore.getViewScaleSnapshot(),
    style: structuredClone(style),
    lightStrength: viewState.lightStrength,
    unitCellLineStyle,
    showCrystalAxisLabels,
    previewMeshQuality,
  }), [
    cameraControlsPanelState,
    cameraInteractionStore,
    componentOpacity,
    componentVisibility,
    effectivePeriodicCellRange,
    previewMeshQuality,
    showCrystalAxisLabels,
    style,
    unitCellLineStyle,
    viewState.lightStrength,
  ]);
  const handleApplyDisplayPreset = useCallback((snapshot: DisplayPresetSnapshot): string | null => {
    setComponentOpacity(structuredClone(snapshot.componentOpacity));
    setComponentVisibility(structuredClone(snapshot.componentVisibility));
    setStyle(structuredClone(snapshot.style));
    setPreviewMeshQuality(snapshot.previewMeshQuality);
    setUnitCellLineStyle(snapshot.unitCellLineStyle);
    setShowCrystalAxisLabels(snapshot.showCrystalAxisLabels);
    handleCameraStateChange(structuredClone(snapshot.cameraState));
    cameraInteractionStore.requestViewScale(snapshot.viewScale);
    handleLightStrengthChange(snapshot.lightStrength);
    const periodicError = handlePeriodicCellRangeChange(snapshot.periodicCellRange);
    if (periodicError) {
      setPeriodicNotice(`Preset cell range skipped: ${periodicError}`);
      return `Applied preset, but skipped the cell range: ${periodicError}`;
    }
    return "Preset applied.";
  }, [
    cameraInteractionStore,
    handleCameraStateChange,
    handleLightStrengthChange,
    handlePeriodicCellRangeChange,
  ]);
  const renderedStyle = useMemo(
    () => scalarColors
      ? { ...style, bondColorMode: "unicolor" as const, bondColor: "#9ca3af" }
      : style,
    [scalarColors, style],
  );
  const {
    exportError,
    exportProjectedSize,
    exportSettings,
    handleExportFigure,
    handleExportSettingsChange,
    isExporting,
    resetExportState,
    setExportError,
    syncProjectedSizeForExportTab,
  } = useFigureExportController({
    cameraOrientationRef,
    cellRange: effectivePeriodicCellRange,
    componentOpacity,
    componentVisibility,
    lightStrength: viewState.lightStrength,
    measurements,
    scene: repeatedSiteFilteredScene,
    scalarLegend,
    selectedFileName: displayFileName,
    showCrystalAxisLabels,
    style: renderedStyle,
    siteColorOverrides: scalarColors,
    unitCellLineStyle,
    visibleScene,
  });
  const {
    handleSceneContextMenuCapture,
    handleScenePointerDownCapture,
    handleScenePointerEndCapture,
    handleScenePointerMoveCapture,
    handleSceneWheelCapture,
    lockedInteractionFeedbackCount,
    resetLockedInteractionFeedback,
    triggerLockedInteractionFeedback,
  } = useLockedInteractionFeedback({
    hasVisibleScene,
    interactionLocked: viewState.interactionLocked,
  });

  useEffect(() => {
    inspectedAtomIdRef.current = inspectedAtomId;
  }, [inspectedAtomId]);

  useEffect(() => {
    reconcileAtomSelection(scene);
  }, [reconcileAtomSelection, scene]);

  useEffect(() => {
    if (!pulseAtom) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setPulseAtom((currentPulseAtom) =>
        currentPulseAtom?.token === pulseAtom.token ? null : currentPulseAtom,
      );
    }, ATOM_HIGHLIGHT_PULSE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [pulseAtom]);

  const resetLoadedPreviewState = useCallback(
    (
      nextScene: SceneSpec | null,
      options: ResetLoadedPreviewOptions = {},
    ) => {
      setErrorMessage(null);
      resetExportState();
      setInspectedAtomId(null);
      setPulseAtom(null);
      if (!options.preserveInspectorOpen) {
        setIsInspectorOpen(false);
      }
      setComponentVisibility(createDefaultComponentVisibility(nextScene));
      setComponentOpacity(createDefaultComponentOpacity());
      setStyle(createDefaultStyle());
      setPreviewMeshQuality(defaultPreviewMeshQualityForScene(nextScene));
      setUnitCellLineStyle(DEFAULT_UNIT_CELL_LINE_STYLE);
      setShowCrystalAxisLabels(DEFAULT_SHOW_CRYSTAL_AXIS_LABELS);
      resetAtomSelection();
      resetPeriodicDisplay();
      resetAtomProperties();
      resetMeasurements();
      if (!options.preserveActiveCommonPanelTab) {
        setActiveCommonPanelTab("display");
      }
      resetLockedInteractionFeedback();
      setIsStructureSummaryCollapsed(true);
      resetCameraForScene(nextScene);
    },
    [
      resetCameraForScene,
      resetAtomProperties,
      resetAtomSelection,
      resetExportState,
      resetLockedInteractionFeedback,
      resetPeriodicDisplay,
      resetMeasurements,
    ],
  );

  useLayoutEffect(() => {
    resetLoadedPreviewStateRef.current = resetLoadedPreviewState;
  }, [resetLoadedPreviewState]);

  const handlePreviewMeshQualityChange = useCallback((nextQuality: MeshQuality) => {
    setPreviewMeshQuality(nextQuality);
  }, []);

  const handleFogAffectsUnitCellChange = useCallback((fogAffectsUnitCell: boolean) => {
    setStyle((currentStyle) => ({
      ...currentStyle,
      fogAffectsUnitCell,
    }));
  }, []);
  const handleDistinguishSimilarColorsChange = useCallback((distinguishSimilarColors: boolean) => {
    setStyle((currentStyle) => ({
      ...currentStyle,
      distinguishSimilarColors,
    }));
  }, []);

  const handleAtomPulse = useCallback((atomId: string) => {
    if (atomId === inspectedAtomIdRef.current) {
      return;
    }

    inspectedAtomIdRef.current = null;
    setInspectedAtomId(null);
    setPulseAtom((currentPulseAtom) => ({
      atomId,
      token: (currentPulseAtom?.token ?? 0) + 1,
    }));
  }, []);

  const handleAtomInspect = useCallback((atomId: string | null) => {
    inspectedAtomIdRef.current = atomId;
    setInspectedAtomId(atomId);
  }, []);

  const elementColorOverrides = useMemo(
    () =>
      siteFilteredScene
        ? elementColorOverridesForStyle(siteFilteredScene.atoms, style)
        : undefined,
    [siteFilteredScene, style],
  );
  const legendColorScheme = baseColorSchemeForStyle(style);
  const legendEntries = useMemo(
    () =>
      deriveElementLegendEntries(
        siteFilteredScene,
        legendColorScheme,
        elementColorOverrides,
      ),
    [elementColorOverrides, legendColorScheme, siteFilteredScene],
  );
  const handleLegendElementColorChange = useCallback((element: string, color: string) => {
    setStyle((currentStyle) => {
      const draft =
        currentStyle.colorSchemeMode === "custom" && currentStyle.customColormap
          ? currentStyle.customColormap
          : createCustomColormapFromScheme(currentStyle.colorScheme);

      return {
        ...currentStyle,
        colorSchemeMode: "custom",
        colorScheme: draft.baseColorScheme,
        customColormap: {
          baseColorScheme: draft.baseColorScheme,
          elements: {
            ...draft.elements,
            [element]: color,
          },
        },
      };
    });
  }, []);
  const previewSafeArea = previewSafeAreaForInspector();
  const inspectorOpenWidth = isInspectorOpen && scene !== null ? inspectorPanelWidth : 0;
  // The structure-analysis panel is a resizable left-hand column; when open it
  // shifts the scene rightward so the structure is not hidden behind it (mirror
  // of the right-hand panels). The a/b/c gizmo instead lives inside the fixed
  // top-left display panel, so it stays put regardless of the analysis panel.
  const analysisPanelOpen = isAnalysisOpen && trajectoryActive;
  const analysisOpenWidth = analysisPanelOpen ? analysisPanelWidth : 0;
  const sceneOffsetX =
    rightPanelsSceneOffsetX(
      inspectorOpenWidth,
      isElectronicOpen ? electronicPanelWidth : 0,
      viewportSize.width,
    ) + leftPanelSceneOffsetX(analysisOpenWidth, viewportSize.width);
  const handleUnifiedResetAllSettings = useCallback(async () => {
    if ((iprActive || trajectoryActive || densityActive) && scene) {
      if (trajectoryActive) {
        setBondAlgorithm("custom-cutoff");
        setBondCutoffs(bondCutoffPairsFromScene(scene));
      }
      resetLoadedPreviewStateForPreview(scene, {
        preserveActiveCommonPanelTab: true,
        preserveInspectorOpen: true,
      });
      return;
    }
    await handleResetAllSettings();
  }, [
    densityActive,
    handleResetAllSettings,
    iprActive,
    resetLoadedPreviewStateForPreview,
    scene,
    setBondAlgorithm,
    setBondCutoffs,
    trajectoryActive,
  ]);
  const renderPreviewContextMenuContent = () => (
    <ContextMenuContent className="w-36">
      <ContextMenuGroup>
        <ContextMenuItem
          disabled={!scene || previewStatus === "loading"}
          onSelect={handleResetView}
        >
          <RotateCcw aria-hidden="true" />
          Reset view
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem onSelect={() => fileInputRef.current?.click()}>
          <FolderOpen aria-hidden="true" />
          Open file
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!scene || isExporting || previewStatus === "loading"}
          onSelect={() => {
            void handleExportFigure();
          }}
        >
          <ImageDown aria-hidden="true" />
          Export figure
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem
          disabled={!scene || previewStatus === "loading"}
          onSelect={() => {
            void handleUnifiedResetAllSettings();
          }}
        >
          <RefreshCw aria-hidden="true" />
          Reset all
        </ContextMenuItem>
      </ContextMenuGroup>
    </ContextMenuContent>
  );

  useEffect(() => {
    if (!inspectedAtomId) {
      return;
    }

    if (!visibleScene || !componentVisibility.atoms || !inspectedAtomInfo) {
      setInspectedAtomId(null);
    }
  }, [componentVisibility.atoms, inspectedAtomId, inspectedAtomInfo, visibleScene]);

  useEffect(() => {
    if (activeCommonPanelTab !== "export") {
      return;
    }

    syncProjectedSizeForExportTab();
  }, [activeCommonPanelTab, cameraOrientationVersion, syncProjectedSizeForExportTab]);

  return (
    <main className="relative h-dvh min-w-80 overflow-hidden bg-background text-foreground">
      <input
        ref={fileInputRef}
        type="file"
        aria-label="Structure file"
        className="hidden"
        tabIndex={-1}
        onChange={(event) => void handleFileChange(event)}
      />

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <section
            className={cn(
              "scene-stage absolute inset-0",
              !isResizingRightPanel &&
                "transition-transform duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
            )}
            style={{ transform: `translateX(${sceneOffsetX}px)` }}
            aria-label="Crystal structure preview"
            onPointerCancelCapture={handleScenePointerEndCapture}
            onContextMenuCapture={handleSceneContextMenuCapture}
            onPointerDownCapture={handleScenePointerDownCapture}
            onPointerMoveCapture={handleScenePointerMoveCapture}
            onPointerUpCapture={handleScenePointerEndCapture}
            onWheelCapture={handleSceneWheelCapture}
          >
            {visibleScene ? (
              <LatticeScene
                atomPickingEnabled={activeCommonPanelTab === "select" && measurementTool === null}
                atomMeasurementEnabled={measurementTool !== null && measurementTool !== "bond"}
                bondPickingEnabled={measurementTool === "bond"}
                cellRange={effectivePeriodicCellRange}
                cameraAnimatedCommandVersion={cameraAnimatedCommandVersion}
                cameraCommandVersion={cameraCommandVersion}
                cameraState={viewState.camera}
                cameraOrientationRef={cameraOrientationRef}
                onCameraOrientationFrame={requestOrientationGizmoFrame}
                onCameraOrientationChange={handleCameraOrientationChange}
                onCameraCommandAnimationActiveChange={handleCameraCommandAnimationActiveChange}
                onCameraControlsInteractionActiveChange={
                  handleCameraControlsInteractionActiveChange
                }
                onAtomInspect={handleAtomInspect}
                onAtomPulse={handleAtomPulse}
                onAtomSelectionToggle={handleSiteSelectionToggle}
                onAtomMeasurementPick={handleAtomMeasurementPick}
                onBondMeasurementPick={handleBondMeasurementPick}
                onLockedInteractionAttempt={triggerLockedInteractionFeedback}
                cameraInteractionStore={cameraInteractionStore}
                suspendCameraOrientationUpdates={
                  isCameraCommandAnimationActive ||
                  isCameraControlsInteractionActive ||
                  isCameraRollInteractionActive
                }
                interactionLocked={viewState.interactionLocked}
                interactionMode={viewState.interactionMode}
                isosurface={densityActive ? densityIsosurface : null}
                layoutScene={scene ?? visibleScene}
                resetCounter={viewState.resetCounter}
                safeArea={previewSafeArea}
                scene={visibleScene}
                selectedSiteIndices={
                  selectedSiteIndicesForHighlight(selectedSiteIndices, selectedOnly)
                }
                siteColorOverrides={scalarColors}
                measurements={measurements}
                measurementDraft={measurementDraft}
                measurementTool={measurementTool}
                inspectedAtomId={inspectedAtomId}
                pulseAtomId={pulseAtom?.atomId ?? null}
                pulseToken={pulseAtom?.token ?? 0}
                previewMeshQuality={previewMeshQuality}
                componentOpacity={componentOpacity}
                dragSensitivity={viewState.dragSensitivity}
                lightStrength={viewState.lightStrength}
                previewFpsStore={previewFpsStore}
                style={renderedStyle}
                showAtoms={componentVisibility.atoms}
                showFpsOverlay={viewState.showFpsOverlay}
                showUnitCell={componentVisibility.unitCell}
                unitCellLineStyle={unitCellLineStyle}
              />
            ) : (
              <div
                className="grid h-full w-full place-items-center bg-background text-sm text-muted-foreground"
                data-state={previewStatus}
              >
                {previewStatus === "loading" ? null : "No structure loaded"}
              </div>
            )}
            {previewStatus === "loading" ? (
              // Sits above the canvas so the loading state is visible while a large file is
              // parsed, even when an earlier scene is still on screen (e.g. loading a new
              // trajectory over the current one).
              <div
                className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-background/70 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
                data-testid="preview-loading-overlay"
                data-state={previewStatus}
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/90 px-3.5 py-1.5 text-sm text-muted-foreground shadow-sm">
                  <span
                    aria-hidden="true"
                    data-testid="loading-structure-spinner"
                    className="inline-flex size-3 shrink-0 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground motion-safe:animate-spin motion-safe:[animation-duration:450ms]"
                  />
                  {loadingLabel}
                </span>
              </div>
            ) : null}
          </section>
        </ContextMenuTrigger>
        {renderPreviewContextMenuContent()}
      </ContextMenu>

      {trajectory.meta ? (
        <TrajectoryPlayer
          disabled={previewStatus === "loading" && !trajectory.frameScene}
          frameIndex={trajectory.frameIndex}
          isPlaying={trajectory.isPlaying}
          meta={trajectory.meta}
          onApplyTypeMap={(typeMap) => void trajectory.applyTypeMap(typeMap)}
          onFpsChange={trajectory.setPlaybackFps}
          onFrameChange={trajectory.goToFrame}
          onOpenAnalysis={() => setIsAnalysisOpen(true)}
          onTogglePlay={trajectory.togglePlay}
          playbackFps={trajectory.playbackFps}
        />
      ) : null}

      <AnalysisPanel
        isOpen={isAnalysisOpen && trajectoryActive}
        onClose={() => setIsAnalysisOpen(false)}
        trajectoryId={trajectory.meta?.trajectoryId ?? null}
        symbols={trajectory.meta?.elements ?? []}
        frameCount={trajectory.meta?.frameCount ?? 0}
        width={analysisPanelWidth}
        onWidthChange={setAnalysisPanelWidth}
        onResizeActiveChange={setIsResizingRightPanel}
      />

      {/* Electronic-properties toggle: an independent icon button stacked below
          the inspector toggle (or at the corner when no structure is loaded). */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Electronic properties"
        aria-pressed={isElectronicOpen}
        title="Electronic properties"
        className={cn(
          TOOL_ICON_BUTTON_CLASS,
          "absolute right-4 z-40 size-8 rounded-[10px] [&_svg]:size-4",
          scene ? "top-[3.25rem]" : "top-4",
          isElectronicOpen
            ? TOOL_ICON_BUTTON_ACTIVE_CLASS
            : "border-foreground/10 bg-card/80 backdrop-blur-xl backdrop-saturate-150",
        )}
        onClick={() => setIsElectronicOpen((open) => !open)}
      >
        <Zap aria-hidden="true" />
      </Button>

      <ElectronicPanel
        iprSessionVersion={iprSessionVersion}
        isOpen={isElectronicOpen}
        width={electronicPanelWidth}
        onWidthChange={setElectronicPanelWidth}
        onResizeActiveChange={setIsResizingRightPanel}
        rightOffset={electronicPanelRightOffset(inspectorOpenWidth)}
        onDensitySceneChange={handleDensitySceneChange}
        onIsosurfaceChange={handleIsosurfaceChange}
        onIprApply={handleIprApply}
        onIprClear={handleIprClear}
        onIprColor={handleIprColor}
        onIprSceneLoad={handleIprSceneLoad}
        structureSelectedOnly={selectedOnly}
        structureSelectedSiteIndices={selectedSiteIndices}
        structureVisibleSiteIndices={visibleCanonicalSiteIndices}
      />

      {scalarLegend ? (
        <ScalarLegend
          spec={scalarLegend}
          offsetX={sceneOffsetX}
          safeArea={previewSafeArea}
          bottomPx={trajectory.meta ? 124 : 28}
        />
      ) : legendEntries.length > 0 ? (
        <ElementLegend
          entries={legendEntries}
          offsetX={sceneOffsetX}
          onElementColorChange={handleLegendElementColorChange}
          safeArea={previewSafeArea}
          bottomPx={trajectory.meta ? 124 : 28}
        />
      ) : null}

      {measurementTool && visibleScene ? (
        <MeasurementInfoCard
          activeTool={measurementTool}
          draft={measurementDraft}
          isInspectorOpen={isInspectorOpen}
          record={measurements[0] ?? null}
          scene={visibleScene}
          onClose={() => handleMeasurementToolChange(null)}
        />
      ) : inspectedAtomInfo ? (
        <AtomInspectorCard
          colorScheme={legendColorScheme}
          colorOverrides={elementColorOverrides}
          info={inspectedAtomInfo}
          isInspectorOpen={isInspectorOpen}
          onClose={() => setInspectedAtomId(null)}
        />
      ) : null}

      <div
        className={cn(
          "absolute left-4 top-4 flex w-[296px] max-w-[calc(100vw-2rem)] flex-col gap-4",
          !isResizingRightPanel &&
            "transition-[left] duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          isInspectorOpen ? "max-[760px]:hidden" : null,
        )}
        // Slide the whole display panel (with the a/b/c axes below it) out from
        // behind the analysis panel so neither is ever covered by it.
        style={analysisOpenWidth > 0 ? { left: analysisOpenWidth + 16 } : undefined}
      >
        <StructureSummaryCard
          isCollapsed={isStructureSummaryCollapsed}
          onCollapsedChange={setIsStructureSummaryCollapsed}
          onOpenStructure={() => fileInputRef.current?.click()}
          previewStatus={previewStatus}
          scene={scene}
          selectedFileName={displayFileName}
        />

        {scene ? (
          <div>
            <CommonControlsPanel
              activeTab={activeCommonPanelTab}
              atomSelectionSessionVersion={atomSelectionSessionVersion}
              cameraState={cameraControlsPanelState}
              canonicalAtoms={canonicalAtoms}
              cellVectors={scene.cell.vectors}
              componentOpacity={componentOpacity}
              style={style}
              exportProjectedSize={exportProjectedSize ?? undefined}
              componentVisibility={componentVisibility}
              exportError={exportError}
              exportSettings={exportSettings}
              hasPolyhedra={hasPolyhedra(scene)}
              getDisplayPresetSnapshot={getDisplayPresetSnapshot}
              isExporting={isExporting}
              isSiteVisible={handleIsSiteVisible}
              isSiteBaseVisible={handleIsSiteBaseVisible}
              onActiveTabChange={handleCommonPanelTabChange}
              onAtomRadiusModelChange={(atomRadiusModel) => {
                setStyle((currentStyle) => ({ ...currentStyle, atomRadiusModel }));
              }}
              onCameraPrimaryChange={handleCameraPrimaryChange}
              onCameraRollPreviewChange={handleCameraRollPreviewChange}
              onCameraRollPreviewStart={handleCameraRollPreviewStart}
              onCameraRollChange={handleCameraRollChange}
              onCameraSecondaryChange={handleCameraSecondaryChange}
              onCameraStateChange={handleCameraStateChange}
              onComponentOpacityChange={setComponentOpacity}
              onExport={handleExportFigure}
              onExportSettingsChange={handleExportSettingsChange}
              onStyleChange={setStyle}
              onComponentVisibilityChange={setComponentVisibility}
              onPeriodicCellRangeChange={handlePeriodicCellRangeChange}
              onPeriodicCellRangeReset={handlePeriodicCellRangeReset}
              onElementVisibilityToggle={handleSelectElementVisibilityToggle}
              onHideSelected={handleHideSelected}
              onInvertSelection={handleSelectInvertSelection}
              onApplyDisplayPreset={handleApplyDisplayPreset}
              onSelectedOnlyChange={handleSelectedOnlyChange}
              onSelectionClear={handleClearSelection}
              onShowAllSites={handleShowAll}
              onSiteSelectionToggle={handleSiteSelectionToggle}
              onSiteVisibilityToggle={handleSiteVisibilityToggle}
              selectedSiteIndices={selectedSiteIndices}
              selectedOnly={selectedOnly}
              periodicCellRange={periodicCellRange}
              periodicDisabledReason={periodicDisabledReason}
              periodicNotice={periodicNotice}
            />
          </div>
        ) : null}

        {/* The a/b/c axes sit at the bottom of the display panel as a fixed
            member of it — no background of their own, and they travel with the
            panel rather than floating over the scene. */}
        {visibleScene ? (
          <OrientationGizmo
            cameraOrientationRef={cameraOrientationRef}
            cellVectors={visibleScene.cell.vectors}
            className="relative self-center"
            frameRequestRef={orientationGizmoFrameRequestRef}
            onAxisClick={handleGizmoAxisClick}
            orientationVersion={cameraOrientationVersion}
            showLabels={showCrystalAxisLabels}
            style={{ height: 200, width: 200 }}
          />
        ) : null}
      </div>

      {errorMessage ? (
        <Alert
          className={cn(
            "absolute top-4 z-20 w-[320px] rounded-xl shadow-sm shadow-foreground/5",
            scene ? "left-[386px]" : "left-[328px]",
            "max-[760px]:left-4 max-[760px]:right-4 max-[760px]:top-[10rem] max-[760px]:w-auto",
          )}
          onDismiss={() => setErrorMessage(null)}
        >
          <AlertTriangleIcon aria-hidden="true" />
          <AlertTitle className="font-semibold">{errorTitle}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {scene ? (
        <>
          <ViewControlRail
            className={cn(isInspectorOpen ? "max-[760px]:hidden" : null)}
            interactionLocked={viewState.interactionLocked}
            lockedInteractionFeedbackCount={lockedInteractionFeedbackCount}
            onInteractionLockedChange={handleInteractionLockedChange}
            onResetView={handleResetView}
            propertyState={propertyState}
            propertyOptions={propertyOptions}
            propertyColorOptions={propertyColorOptions}
            propertyLoading={propertyLoading}
            propertyError={propertyError}
            propertyMatchCount={propertyMatches?.size ?? null}
            onPropertyStateChange={setPropertyState}
            onSelectPropertyMatches={handleSelectPropertyMatches}
            measurementTool={measurementTool}
            onMeasurementToolChange={handleMeasurementToolChange}
            cameraInteractionStore={cameraInteractionStore}
            previewFpsStore={previewFpsStore}
            showFps={viewState.showFpsOverlay}
          />

          <InspectorToggle
            isOpen={isInspectorOpen}
            onOpenChange={setIsInspectorOpen}
          />

          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="contents">
                <InspectorSidebar
                  bondAlgorithm={bondAlgorithm}
                  bondCutoffs={bondCutoffs}
                  dragSensitivity={viewState.dragSensitivity}
                  interactionMode={viewState.interactionMode}
                  lightStrength={viewState.lightStrength}
                  isCustomColorScheme={style.colorSchemeMode === "custom"}
                  isOpen={isInspectorOpen}
                  isSceneLoading={previewStatus === "loading" || iprActive}
                  width={inspectorPanelWidth}
                  onWidthChange={setInspectorPanelWidth}
                  onResizeActiveChange={setIsResizingRightPanel}
                  previewMeshQuality={previewMeshQuality}
                  fogAffectsUnitCell={style.fogAffectsUnitCell}
                  distinguishSimilarColors={style.distinguishSimilarColors}
                  showFpsOverlay={viewState.showFpsOverlay}
                  showCrystalAxisLabels={showCrystalAxisLabels}
                  unitCellLineStyle={unitCellLineStyle}
                  onBondAlgorithmChange={handleUnifiedBondAlgorithmChange}
                  onBondCutoffChange={handleUnifiedBondCutoffChange}
                  onDragSensitivityChange={handleDragSensitivityChange}
                  onInteractionModeChange={handleInteractionModeChange}
                  onLightStrengthChange={handleLightStrengthChange}
                  onPreviewMeshQualityChange={handlePreviewMeshQualityChange}
                  onFogAffectsUnitCellChange={handleFogAffectsUnitCellChange}
                  onDistinguishSimilarColorsChange={handleDistinguishSimilarColorsChange}
                  onShowFpsOverlayChange={handleShowFpsOverlayChange}
                  onShowCrystalAxisLabelsChange={setShowCrystalAxisLabels}
                  onUnitCellLineStyleChange={setUnitCellLineStyle}
                />
              </div>
            </ContextMenuTrigger>
            {renderPreviewContextMenuContent()}
          </ContextMenu>
        </>
      ) : null}
    </main>
  );
}
