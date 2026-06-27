import { describe, expect, test } from "bun:test";

import {
  createFigureExportZipBlob,
  createZipBlob,
  type FigureExportFile,
} from "../src/app/exportFigure";

describe("exportFigure", () => {
  test("creates an uncompressed ZIP with foldered export files", async () => {
    const files: FigureExportFile[] = [
      {
        blob: new Blob(["structure"]),
        fileName: "NaCl.png",
        format: "png",
      },
      {
        blob: new Blob(["legend"]),
        fileName: "NaCl-legend.png",
        format: "png",
      },
    ];

    const zip = await createFigureExportZipBlob(files, "NaCl");
    const bytes = new Uint8Array(await zip.arrayBuffer());

    expect(zip.type).toBe("application/zip");
    expect(zipFileNames(bytes)).toEqual(["NaCl/NaCl.png", "NaCl/NaCl-legend.png"]);
  });

  test("creates a valid empty ZIP envelope", async () => {
    const zip = await createZipBlob([]);
    const bytes = new Uint8Array(await zip.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    expect(view.getUint32(0, true)).toBe(0x06054b50);
    expect(view.getUint16(8, true)).toBe(0);
    expect(view.getUint16(10, true)).toBe(0);
  });
});

function zipFileNames(bytes: Uint8Array): string[] {
  const names: string[] = [];
  const decoder = new TextDecoder();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  while (offset + 4 <= bytes.byteLength && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const fileNameStart = offset + 30;
    names.push(decoder.decode(bytes.subarray(fileNameStart, fileNameStart + fileNameLength)));
    offset = fileNameStart + fileNameLength + extraLength + compressedSize;
  }

  return names;
}
