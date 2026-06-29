import type { PDFDocument, PDFFont } from "pdf-lib";

import type { ExportBackground } from "../model";
import type { RasterExportImage } from "../scene/exportRenderer";
import {
  exportTextColor,
  exportTextHaloColor,
  hexColorToRgbComponents,
} from "./rasterCanvas";

const GEIST_PDF_REGULAR_FONT_URL = new URL("../assets/fonts/Geist-Regular.ttf", import.meta.url).href;
const GEIST_PDF_ITALIC_FONT_URL = new URL("../assets/fonts/Geist-MediumItalic.ttf", import.meta.url).href;

export async function encodeRasterTextPdf(
  rasterImage: RasterExportImage,
  options: { background: ExportBackground; halo: boolean },
): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([rasterImage.width, rasterImage.height]);
  const imageBytes = new Uint8Array(await rasterImage.blob.arrayBuffer());
  const image = await pdf.embedPng(imageBytes);
  const { regularFont, italicFont } = await embedPdfTextFonts(pdf, StandardFonts);
  const textColor = rgb(...hexColorToRgbComponents(exportTextColor(options.background)));
  const textHaloColor = rgb(...hexColorToRgbComponents(exportTextHaloColor(options.background)));

  page.drawImage(image, {
    height: rasterImage.height,
    width: rasterImage.width,
    x: 0,
    y: 0,
  });

  for (const item of rasterImage.textItems ?? []) {
    const font = item.fontStyle === "italic" ? italicFont : regularFont;
    const width = font.widthOfTextAtSize(item.label, item.size);
    const x = item.fontStyle === "italic" ? item.x - width / 2 : item.x;
    const y = rasterImage.height - item.y - item.size * 0.36;

    if (options.halo) {
      const haloOffset = Math.max(0.75, item.size / 96);
      for (const [offsetX, offsetY] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        page.drawText(item.label, {
          color: textHaloColor,
          font,
          size: item.size,
          x: x + offsetX * haloOffset,
          y: y + offsetY * haloOffset,
        });
      }
    }

    page.drawText(item.label, {
      color: textColor,
      font,
      size: item.size,
      x,
      y,
    });
  }

  const pdfBytes = await pdf.save();
  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfBuffer).set(pdfBytes);
  return new Blob([pdfBuffer], { type: "application/pdf" });
}

export async function encodeRasterPdf(rasterImage: RasterExportImage): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
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

  const pdfBytes = await pdf.save();
  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfBuffer).set(pdfBytes);
  return new Blob([pdfBuffer], { type: "application/pdf" });
}

async function embedPdfTextFonts(
  pdf: PDFDocument,
  standardFonts: typeof import("pdf-lib").StandardFonts,
): Promise<{ regularFont: PDFFont; italicFont: PDFFont }> {
  type PdfFontkit = Parameters<PDFDocument["registerFontkit"]>[0];
  type PdfFontkitModule = typeof import("@pdf-lib/fontkit") & { default?: PdfFontkit };
  const fallbackFonts = async () => ({
    italicFont: await pdf.embedFont(standardFonts.HelveticaOblique),
    regularFont: await pdf.embedFont(standardFonts.Helvetica),
  });

  try {
    const fontkitModule = (await import("@pdf-lib/fontkit")) as PdfFontkitModule;
    const fontkit = fontkitModule.default ?? fontkitModule;
    pdf.registerFontkit(fontkit);
    const [regularFontBytes, italicFontBytes] = await Promise.all([
      fetchFontBytes(GEIST_PDF_REGULAR_FONT_URL),
      fetchFontBytes(GEIST_PDF_ITALIC_FONT_URL),
    ]);

    return {
      italicFont: await pdf.embedFont(italicFontBytes),
      regularFont: await pdf.embedFont(regularFontBytes),
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Falling back to PDF standard fonts because Geist embedding failed.", error);
    }
    return fallbackFonts();
  }
}

async function fetchFontBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load PDF font asset: ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
