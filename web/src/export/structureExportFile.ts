import { createCameraPoseSnapshot } from "../scene/cameraPose";
import {
  validateExportSettings,
  visibleSceneForComponents,
} from "../model";
import { encodeRasterPdf } from "./pdfTextExport";
import { renderExportRaster } from "./structureRasterExport";
import type {
  CreateFigureExportOptions,
  FigureExportFile,
} from "./types";
import { exportFileStem } from "./fileNames";

export async function createStructureExportFile({
  cameraOrientationRef,
  cellRange,
  componentOpacity,
  componentVisibility,
  fileName,
  lightStrength,
  measurements,
  scene,
  settings,
  style,
  siteColorOverrides,
  unitCellLineStyle,
}: CreateFigureExportOptions): Promise<FigureExportFile> {
  const validation = validateExportSettings(settings);
  if (!validation.valid) {
    throw new Error(validation.message ?? "Export settings are invalid.");
  }

  const visibleScene = visibleSceneForComponents(scene, componentVisibility);
  if (!visibleScene) {
    throw new Error("No structure is available to export.");
  }

  const cameraPose = createCameraPoseSnapshot(cameraOrientationRef.current);
  const rasterImage = await renderExportRaster({
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
  });

  if (settings.format === "pdf") {
    return {
      blob: await encodeRasterPdf(rasterImage),
      fileName: `${exportFileStem(fileName)}.pdf`,
      format: "pdf",
    };
  }

  return {
    blob: rasterImage.blob,
    fileName: `${exportFileStem(fileName)}.${settings.format}`,
    format: settings.format,
  };
}
