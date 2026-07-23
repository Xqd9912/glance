import { createCameraPoseSnapshot } from "../scene/cameraPose";
import { visibleSceneForComponents } from "../model";
import { encodeRasterTextPdf } from "./pdfTextExport";
import { renderCombinedExportRaster } from "./combinedExportRaster";
import type {
  CreateFigureExportOptions,
  FigureExportFile,
} from "./types";
import { exportFileStem } from "./fileNames";

export async function createCombinedExportFile({
  cameraOrientationRef,
  cellRange,
  componentOpacity,
  componentVisibility,
  fileName,
  lightStrength,
  measurements,
  scene,
  scalarLegend,
  settings,
  showCrystalAxisLabels,
  style,
  siteColorOverrides,
  unitCellLineStyle,
}: CreateFigureExportOptions): Promise<FigureExportFile> {
  const visibleScene = visibleSceneForComponents(scene, componentVisibility);
  const cameraPose = createCameraPoseSnapshot(cameraOrientationRef.current);
  const rasterImage = await renderCombinedExportRaster({
    cameraPose,
    cellRange,
    componentOpacity,
    componentVisibility,
    lightStrength,
    measurements,
    scene,
    scalarLegend,
    settings,
    showCrystalAxisLabels,
    style,
    siteColorOverrides,
    unitCellLineStyle,
    visibleScene,
  });

  if (settings.format === "pdf") {
    return {
      blob: await encodeRasterTextPdf(rasterImage, {
        background: settings.background,
        halo: false,
      }),
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
