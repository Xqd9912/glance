import type {
  ExportBackground,
  ExportFormat,
  ExportSettingsState,
} from "../model";
import type { RasterExportTextItem } from "../scene/exportRenderer";
import type { ElementLegendEntry } from "../app/elementLegend";
import {
  assertExportCanvasSize,
  canvasToPngBlob,
  canvasToRasterBlob,
  downsampleCanvas,
  exportTextColor,
  fillCanvasBackground,
  rasterFormatForExportFormat,
} from "./rasterCanvas";
import { encodeRasterTextPdf } from "./pdfTextExport";
import type { FigureExportFile } from "./types";

const LEGEND_FONT_FAMILY = "Geist, Helvetica Neue, Arial, sans-serif";
const LEGEND_EXPORT_FONT_RATIO = 0.045;
const LEGEND_SWATCH_STROKE_RATIO = 0.1;

export interface LegendExportStyle {
  fontSize: number;
  horizontalGap: number;
  paddingX: number;
  paddingY: number;
  rowGap: number;
  swatchSize: number;
  textGap: number;
}

export async function createLegendExportFile({
  background,
  entries,
  fileName,
  format,
  layout,
  style,
  supersampling,
}: {
  background: ExportBackground;
  entries: ElementLegendEntry[];
  fileName: string;
  format: ExportFormat;
  layout: "horizontal" | "vertical";
  style: LegendExportStyle;
  supersampling: number;
}): Promise<FigureExportFile> {
  const renderedLegend = renderLegendCanvas({
    background,
    entries,
    includeText: format !== "pdf",
    layout,
    style,
    supersampling,
  });

  if (format === "pdf") {
    return {
      blob: await encodeRasterTextPdf(
        {
          blob: await canvasToPngBlob(renderedLegend.canvas),
          height: renderedLegend.canvas.height,
          textItems: renderedLegend.textItems,
          width: renderedLegend.canvas.width,
        },
        { background, halo: false },
      ),
      fileName,
      format,
    };
  }

  return {
    blob: await canvasToRasterBlob(renderedLegend.canvas, rasterFormatForExportFormat(format)),
    fileName,
    format,
  };
}

export function renderLegendCanvas({
  background,
  entries,
  includeText,
  layout,
  style,
  supersampling,
  textBackground = background,
}: {
  background: ExportBackground;
  entries: ElementLegendEntry[];
  includeText: boolean;
  layout: "horizontal" | "vertical";
  style: LegendExportStyle;
  supersampling: number;
  textBackground?: ExportBackground;
}): { canvas: HTMLCanvasElement; textItems: RasterExportTextItem[] } {
  const metrics = measureLegend(entries, layout, style);
  const outputWidth = Math.max(1, metrics.width);
  const outputHeight = Math.max(1, metrics.height);
  const renderWidth = outputWidth * supersampling;
  const renderHeight = outputHeight * supersampling;
  assertExportCanvasSize(renderWidth, renderHeight, "legend");
  const canvas = document.createElement("canvas");
  canvas.width = renderWidth;
  canvas.height = renderHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare the legend export canvas.");
  }

  context.scale(supersampling, supersampling);
  fillCanvasBackground(context, metrics.width, metrics.height, background);
  context.font = legendFont(style);
  context.textBaseline = "middle";
  context.fillStyle = exportTextColor(textBackground);

  const textItems: RasterExportTextItem[] = [];
  for (const item of metrics.items) {
    drawLegendSwatch(context, item.entry.color, item.x, item.y, style.swatchSize);
    const textX = item.x + style.swatchSize + style.textGap;
    const textY = item.y + style.swatchSize / 2;
    textItems.push({
      fontStyle: "normal",
      fontWeight: 400,
      label: item.entry.element,
      size: style.fontSize,
      x: textX,
      y: textY,
    });

    if (includeText) {
      context.fillStyle = exportTextColor(textBackground);
      context.fillText(item.entry.element, textX, textY);
    }
  }

  return {
    canvas: supersampling === 1 ? canvas : downsampleCanvas(canvas, outputWidth, outputHeight),
    textItems,
  };
}

export function legendExportStyle(
  _settings: ExportSettingsState,
  referenceSize: number,
): LegendExportStyle {
  const fontSize = Math.round(referenceSize * LEGEND_EXPORT_FONT_RATIO);

  return {
    fontSize,
    horizontalGap: Math.round(fontSize * 1.05),
    paddingX: Math.round(fontSize * 0.15),
    paddingY: Math.round(fontSize * 0.15),
    rowGap: Math.round(fontSize * 0.85),
    swatchSize: Math.round(fontSize * 0.95),
    textGap: Math.round(fontSize * 0.45),
  };
}

function measureLegend(
  entries: ElementLegendEntry[],
  layout: "horizontal" | "vertical",
  style: LegendExportStyle,
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not measure the legend export.");
  }

  context.font = legendFont(style);
  const itemSizes = entries.map((entry) => ({
    entry,
    width:
      style.swatchSize +
      style.textGap +
      Math.ceil(context.measureText(entry.element).width),
  }));
  const itemHeight = Math.max(style.swatchSize, style.fontSize);

  if (layout === "vertical") {
    const maxItemWidth = Math.max(1, ...itemSizes.map((item) => item.width));
    return {
      height:
        style.paddingY * 2 +
        itemSizes.length * itemHeight +
        Math.max(0, itemSizes.length - 1) * style.rowGap,
      items: itemSizes.map(({ entry }, index) => ({
        entry,
        x: style.paddingX,
        y: style.paddingY + index * (itemHeight + style.rowGap),
      })),
      width: style.paddingX * 2 + maxItemWidth,
    };
  }

  let x = style.paddingX;
  const items = itemSizes.map(({ entry, width }) => {
    const item = {
      entry,
      x,
      y: style.paddingY,
    };
    x += width + style.horizontalGap;
    return item;
  });
  return {
    height: style.paddingY * 2 + itemHeight,
    items,
    width: Math.max(1, x - style.horizontalGap + style.paddingX),
  };
}

function legendFont(style: LegendExportStyle) {
  return `400 ${style.fontSize}px ${LEGEND_FONT_FAMILY}`;
}

function drawLegendSwatch(
  context: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  size: number,
) {
  const radius = size / 2;
  const centerX = x + radius;
  const centerY = y + radius;
  const highlight = context.createLinearGradient(
    x + size,
    y,
    x,
    y + size,
  );
  highlight.addColorStop(0, "rgba(255, 255, 255, 0.38)");
  highlight.addColorStop(0.14, "rgba(255, 255, 255, 0.38)");
  highlight.addColorStop(0.42, "rgba(255, 255, 255, 0)");

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.fillStyle = highlight;
  context.fill();
  context.strokeStyle = "rgba(0, 0, 0, 0.1)";
  context.lineWidth = size * LEGEND_SWATCH_STROKE_RATIO;
  context.stroke();
  context.restore();
}
