import type { SceneSpec } from "../api/scene";
import { createCameraPoseSnapshot, type CameraPoseSnapshot } from "../scene/cameraPose";
import type { RasterExportImage } from "../scene/exportRenderer";
import {
  computeStructureExportFramePlan,
  projectCellFrameLinesToExportFrame,
  type ExportFrameLine,
} from "../scene/exportFrame";
import {
  CELL_FRAME_COLOR_RGB,
  CELL_FRAME_LINE_WIDTH_PIXELS,
} from "../scene/sceneGeometry";
import type {
  ComponentOpacityState,
  ComponentVisibilityState,
  ExportFormat,
  ExportSettingsState,
  StyleState,
} from "./settings";
import { validateExportSettings, visibleSceneForComponents } from "./settings";
import type { CameraOrientationRef } from "../scene/LatticeScene";

export interface CreateFigureExportOptions {
  cameraOrientationRef: CameraOrientationRef;
  componentOpacity: ComponentOpacityState;
  componentVisibility: ComponentVisibilityState;
  fileName: string | null;
  scene: SceneSpec;
  settings: ExportSettingsState;
  style: StyleState;
}

interface PdfVectorOverlay {
  unitCell: {
    lines: ExportFrameLine[];
    opacity: number;
  } | null;
}

export interface FigureExportFile {
  blob: Blob;
  fileName: string;
  format: ExportFormat;
}

export async function createFigureExportFile({
  cameraOrientationRef,
  componentOpacity,
  componentVisibility,
  fileName,
  scene,
  settings,
  style,
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
    componentOpacity,
    componentVisibility,
    settings,
    style,
    visibleScene,
  });

  if (settings.format === "pdf") {
    return {
      blob: await encodeRasterPdf(
        rasterImage,
        createPdfVectorOverlay({
          cameraPose,
          componentOpacity,
          componentVisibility,
          settings,
          style,
          visibleScene,
        }),
      ),
      fileName: exportFileName(fileName, "pdf"),
      format: "pdf",
    };
  }

  return {
    blob: rasterImage.blob,
    fileName: exportFileName(fileName, "png"),
    format: "png",
  };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function renderExportRaster({
  cameraPose,
  componentOpacity,
  componentVisibility,
  settings,
  style,
  visibleScene,
}: {
  cameraPose: CameraPoseSnapshot;
  componentOpacity: ComponentOpacityState;
  componentVisibility: ComponentVisibilityState;
  settings: ExportSettingsState;
  style: StyleState;
  visibleScene: SceneSpec;
}): Promise<RasterExportImage> {
  const { renderStructureRasterPng } = await import("../scene/exportRenderer");

  return renderStructureRasterPng({
    cameraPose,
    componentOpacity,
    height: settings.height,
    meshQuality: settings.meshQuality,
    scene: visibleScene,
    showAtoms: componentVisibility.atoms,
    showUnitCell: componentVisibility.unitCell,
    style,
    supersampling: settings.supersampling,
    width: settings.width,
  });
}

function createPdfVectorOverlay({
  cameraPose,
  componentOpacity,
  componentVisibility,
  settings,
  style,
  visibleScene,
}: {
  cameraPose: CameraPoseSnapshot;
  componentOpacity: ComponentOpacityState;
  componentVisibility: ComponentVisibilityState;
  settings: ExportSettingsState;
  style: StyleState;
  visibleScene: SceneSpec;
}): PdfVectorOverlay {
  if (!componentVisibility.unitCell || componentOpacity.unitCell <= 0) {
    return { unitCell: null };
  }

  const framePlan = computeStructureExportFramePlan({
    cameraPose,
    componentOpacity,
    height: settings.height,
    scene: visibleScene,
    showAtoms: componentVisibility.atoms,
    showUnitCell: componentVisibility.unitCell,
    style,
    width: settings.width,
  });

  return {
    unitCell: {
      lines: projectCellFrameLinesToExportFrame({
        cameraPose,
        framePlan,
        scene: visibleScene,
      }),
      opacity: componentOpacity.unitCell / 100,
    },
  };
}

async function encodeRasterPdf(
  rasterImage: RasterExportImage,
  vectorOverlay: PdfVectorOverlay,
): Promise<Blob> {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([rasterImage.width, rasterImage.height]);
  const imageBytes = new Uint8Array(await rasterImage.blob.arrayBuffer());
  const image = await pdf.embedPng(imageBytes);

  page.drawImage(image, {
    height: rasterImage.height,
    width: rasterImage.width,
    x: 0,
    y: 0,
  });

  if (vectorOverlay.unitCell) {
    const color = rgb(
      CELL_FRAME_COLOR_RGB.red,
      CELL_FRAME_COLOR_RGB.green,
      CELL_FRAME_COLOR_RGB.blue,
    );

    for (const line of vectorOverlay.unitCell.lines) {
      page.drawLine({
        color,
        end: line.end,
        opacity: vectorOverlay.unitCell.opacity,
        start: line.start,
        thickness: CELL_FRAME_LINE_WIDTH_PIXELS,
      });
    }
  }

  const pdfBytes = await pdf.save();
  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfBuffer).set(pdfBytes);
  return new Blob([pdfBuffer], { type: "application/pdf" });
}

function exportFileName(fileName: string | null, format: ExportFormat): string {
  const extension = `.${format}`;
  const sourceName = fileName?.trim() || "pretty-lattice";
  const stem = sourceName
    .replace(/\.[^./\\]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${stem || "pretty-lattice"}${extension}`;
}
