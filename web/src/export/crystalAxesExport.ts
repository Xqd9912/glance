import type { SceneSpec } from "../api/scene";
import type { CameraPoseSnapshot } from "../scene/cameraPose";
import type { RasterExportImage } from "../scene/exportRenderer";
import type {
  ExportBackground,
  ExportFormat,
  ExportSettingsState,
  ExportSupersampling,
} from "../model";
import {
  exportBackgroundColor,
  exportTextColor,
  rasterFormatForExportFormat,
} from "./rasterCanvas";
import { encodeRasterTextPdf } from "./pdfTextExport";
import type { FigureExportFile } from "./types";

const CRYSTAL_AXIS_EXPORT_SIZE_RATIO = 1;
export const CRYSTAL_AXIS_LABEL_HALO_COLOR = "#ffffff";

export async function createCrystalAxesExportFile({
  background,
  cameraPose,
  fileName,
  format,
  scene,
  showCrystalAxisLabels,
  size,
  supersampling,
}: {
  background: ExportBackground;
  cameraPose: CameraPoseSnapshot;
  fileName: string;
  format: ExportFormat;
  scene: SceneSpec;
  showCrystalAxisLabels: boolean;
  size: number;
  supersampling: ExportSupersampling;
}): Promise<FigureExportFile> {
  const rasterImage = await renderCrystalAxesForExport({
    background,
    cameraPose,
    format,
    scene,
    showCrystalAxisLabels,
    size,
    supersampling,
  });

  if (format === "pdf") {
    return {
      blob: await encodeRasterTextPdf(rasterImage, { background, halo: false }),
      fileName,
      format,
    };
  }

  return {
    blob: rasterImage.blob,
    fileName,
    format,
  };
}

export async function renderCrystalAxesForExport({
  background,
  cameraPose,
  format,
  scene,
  showCrystalAxisLabels,
  size,
  supersampling,
}: {
  background: ExportBackground;
  cameraPose: CameraPoseSnapshot;
  format: ExportFormat;
  scene: SceneSpec;
  showCrystalAxisLabels: boolean;
  size: number;
  supersampling: ExportSupersampling;
}): Promise<RasterExportImage> {
  const { renderCrystalAxesRasterImage } = await import("../scene/exportRenderer");
  return renderCrystalAxesRasterImage({
    backgroundColor: exportBackgroundColor(background),
    cameraPose,
    cellVectors: scene.cell.vectors,
    imageFormat: rasterFormatForExportFormat(format),
    includeLabelTextItems: format === "pdf" && showCrystalAxisLabels,
    labelColor: exportTextColor(background),
    labelHaloColor: CRYSTAL_AXIS_LABEL_HALO_COLOR,
    showLabelHalo: format !== "pdf" && background !== "black" && showCrystalAxisLabels,
    showLabels: format !== "pdf" && showCrystalAxisLabels,
    size,
    supersampling,
  });
}

export function crystalAxisExportSize(
  settings: ExportSettingsState,
  referenceSize: number,
): number {
  return Math.round(referenceSize * CRYSTAL_AXIS_EXPORT_SIZE_RATIO);
}
