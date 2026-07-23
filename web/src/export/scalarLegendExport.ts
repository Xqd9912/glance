import type { ExportBackground, ExportFormat, ScalarLegendSpec } from "../model";
import { interpolatePalette } from "../model";
import type { FigureExportFile } from "./types";
import { encodeRasterPdf } from "./pdfTextExport";
import {
  canvasToRasterBlob,
  exportTextColor,
  fillCanvasBackground,
  rasterFormatForExportFormat,
} from "./rasterCanvas";

export async function createScalarLegendExportFile({
  background,
  fileName,
  format,
  referenceSize,
  spec,
}: {
  background: ExportBackground;
  fileName: string;
  format: ExportFormat;
  referenceSize: number;
  spec: ScalarLegendSpec;
}): Promise<FigureExportFile> {
  const canvas = renderScalarLegendCanvas({ background, referenceSize, spec });
  const image = {
    blob: await canvasToRasterBlob(canvas, format === "pdf" ? "png" : rasterFormatForExportFormat(format)),
    height: canvas.height,
    width: canvas.width,
  };
  return {
    blob: format === "pdf" ? await encodeRasterPdf(image) : image.blob,
    fileName,
    format,
  };
}

export function renderScalarLegendCanvas({
  background,
  referenceSize,
  spec,
}: {
  background: ExportBackground;
  referenceSize: number;
  spec: ScalarLegendSpec;
}): HTMLCanvasElement {
  const scale = Math.max(0.75, referenceSize / 640);
  const width = Math.round(360 * scale);
  const height = Math.round(82 * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare the scalar legend export.");
  }
  fillCanvasBackground(context, width, height, background);
  const padding = 14 * scale;
  const barY = 31 * scale;
  const barHeight = 14 * scale;
  const gradient = context.createLinearGradient(padding, 0, width - padding, 0);
  for (let index = 0; index <= 16; index += 1) {
    gradient.addColorStop(index / 16, interpolatePalette(spec.palette, index / 16));
  }
  context.fillStyle = gradient;
  context.fillRect(padding, barY, width - 2 * padding, barHeight);
  context.fillStyle = exportTextColor(background);
  context.textAlign = "center";
  context.font = `600 ${12 * scale}px Geist, Arial, sans-serif`;
  context.fillText(`${spec.label}${spec.unit ? ` (${spec.unit})` : ""}`, width / 2, 17 * scale);
  context.font = `400 ${10 * scale}px ui-monospace, monospace`;
  context.textAlign = "left";
  context.fillText(formatValue(spec.domain.min), padding, 64 * scale);
  context.textAlign = "right";
  context.fillText(formatValue(spec.domain.max), width - padding, 64 * scale);
  return canvas;
}

function formatValue(value: number): string {
  return Math.abs(value) >= 100 || (Math.abs(value) > 0 && Math.abs(value) < 0.01)
    ? value.toExponential(2)
    : value.toFixed(3);
}
