import type { SceneSpec } from "../api/scene";
import type { CameraPoseSnapshot } from "../scene/cameraPose";
import type { RasterExportImage } from "../scene/exportRenderer";
import type {
  ComponentOpacityState,
  ComponentVisibilityState,
  ExportSettingsState,
  PeriodicCellRange,
  MeasurementRecord,
  StyleState,
  UnitCellLineStyle,
} from "../model";
import {
  exportBackgroundColor,
  rasterFormatForExportFormat,
} from "./rasterCanvas";

const DARK_BACKGROUND_UNIT_CELL_LINE_COLOR = "#bbbbbb";

export async function renderExportRaster({
  cameraPose,
  cellRange,
  componentOpacity,
  componentVisibility,
  lightStrength,
  measurements,
  settings,
  style,
  siteColorOverrides,
  unitCellLineStyle,
  visibleScene,
}: {
  cameraPose: CameraPoseSnapshot;
  cellRange?: PeriodicCellRange;
  componentOpacity: ComponentOpacityState;
  componentVisibility: ComponentVisibilityState;
  lightStrength: number;
  measurements?: readonly MeasurementRecord[];
  settings: ExportSettingsState;
  style: StyleState;
  siteColorOverrides?: ReadonlyMap<number, string>;
  unitCellLineStyle: UnitCellLineStyle;
  visibleScene: SceneSpec;
}): Promise<RasterExportImage> {
  const { renderStructureRasterImage } = await import("../scene/exportRenderer");

  return renderStructureRasterImage({
    backgroundColor: exportBackgroundColor(settings.background),
    cameraPose,
    cellRange,
    componentOpacity,
    height: settings.height,
    imageFormat: rasterFormatForExportFormat(settings.format),
    lightStrength,
    measurements,
    meshQuality: settings.meshQuality,
    scene: visibleScene,
    showAtoms: componentVisibility.atoms,
    showUnitCell: componentVisibility.unitCell,
    style,
    siteColorOverrides,
    supersampling: settings.supersampling,
    unitCellLineColor:
      settings.background === "black" ? DARK_BACKGROUND_UNIT_CELL_LINE_COLOR : undefined,
    unitCellLineStyle,
    width: settings.width,
  });
}
