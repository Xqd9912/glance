import type {
  ExportBackground,
  ExportFormat,
} from "../model";
import {
  EXPORT_RENDER_DIMENSION_MAX,
  EXPORT_RENDER_PIXEL_MAX,
} from "../model";
import type { RasterExportFileFormat } from "./types";

const JPG_EXPORT_QUALITY = 0.95;

const EXPORT_BACKGROUND_COLORS: Record<Exclude<ExportBackground, "transparent">, string> = {
  black: "#111111",
  white: "#ffffff",
};
const DARK_BACKGROUND_TEXT_COLOR = "#eeeeee";
const LIGHT_BACKGROUND_TEXT_COLOR = "#202020";
const DARK_BACKGROUND_TEXT_HALO_COLOR = "#111111";
const LIGHT_BACKGROUND_TEXT_HALO_COLOR = "#fafafa";

export function assertExportCanvasSize(width: number, height: number, label: string) {
  if (
    width > EXPORT_RENDER_DIMENSION_MAX ||
    height > EXPORT_RENDER_DIMENSION_MAX ||
    width * height > EXPORT_RENDER_PIXEL_MAX
  ) {
    throw new Error(
      `The ${label} export is too large to render. Reduce the export size or supersampling.`,
    );
  }
}

export function rasterFormatForExportFormat(format: ExportFormat): RasterExportFileFormat {
  return format === "jpg" ? "jpg" : "png";
}

export function exportBackgroundColor(background: ExportBackground): string | null {
  return background === "transparent" ? null : EXPORT_BACKGROUND_COLORS[background];
}

export function fillCanvasBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: ExportBackground,
) {
  const backgroundColor = exportBackgroundColor(background);
  if (!backgroundColor) {
    context.clearRect(0, 0, width, height);
    return;
  }

  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, width, height);
}

export function exportTextColor(background: ExportBackground): string {
  return background === "black" ? DARK_BACKGROUND_TEXT_COLOR : LIGHT_BACKGROUND_TEXT_COLOR;
}

export function exportTextHaloColor(background: ExportBackground): string {
  return background === "black" ? DARK_BACKGROUND_TEXT_HALO_COLOR : LIGHT_BACKGROUND_TEXT_HALO_COLOR;
}

export function hexColorToRgbComponents(color: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) {
    return [0, 0, 0];
  }

  const value = match[1] ?? "000000";
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  ];
}

export function canvasToRasterBlob(
  canvas: HTMLCanvasElement,
  format: RasterExportFileFormat,
): Promise<Blob> {
  return format === "jpg" ? canvasToJpgBlob(canvas) : canvasToPngBlob(canvas);
}

export function downsampleCanvas(sourceCanvas: HTMLCanvasElement, width: number, height: number) {
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const context = outputCanvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare the export downsampling canvas.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(sourceCanvas, 0, 0, width, height);
  return outputCanvas;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not encode the exported PNG image."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

function canvasToJpgBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = canvas.width;
  outputCanvas.height = canvas.height;
  const context = outputCanvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare the exported JPG image.");
  }

  context.fillStyle = EXPORT_BACKGROUND_COLORS.white;
  context.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  context.drawImage(canvas, 0, 0);

  return new Promise((resolve, reject) => {
    outputCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not encode the exported JPG image."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      JPG_EXPORT_QUALITY,
    );
  });
}
