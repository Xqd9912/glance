import type { SceneSpec } from "../api/scene";
import type { CameraOrientationRef } from "../scene/LatticeScene";
import type {
  ComponentOpacityState,
  ComponentVisibilityState,
  ExportFormat,
  ExportSettingsState,
  PeriodicCellRange,
  MeasurementRecord,
  ScalarLegendSpec,
  StyleState,
  UnitCellLineStyle,
} from "../model";

export interface CreateFigureExportOptions {
  cameraOrientationRef: CameraOrientationRef;
  cellRange?: PeriodicCellRange;
  componentOpacity: ComponentOpacityState;
  componentVisibility: ComponentVisibilityState;
  fileName: string | null;
  lightStrength: number;
  measurements?: readonly MeasurementRecord[];
  scene: SceneSpec;
  scalarLegend?: ScalarLegendSpec | null;
  siteColorOverrides?: ReadonlyMap<number, string>;
  settings: ExportSettingsState;
  showCrystalAxisLabels: boolean;
  style: StyleState;
  unitCellLineStyle: UnitCellLineStyle;
}

export interface FigureExportFile {
  blob: Blob;
  fileName: string;
  format: ExportFormat;
}

export type RasterExportFileFormat = Exclude<ExportFormat, "pdf">;
