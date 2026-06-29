import { describe, expect, test } from "bun:test";

import {
  combinedLayerBounds,
  offsetTextItems,
} from "../src/export/combinedExportRaster";

describe("combined export layout", () => {
  test("expands output bounds around accessory layers", () => {
    const bounds = combinedLayerBounds(
      [
        {
          image: rasterImage(200, 160),
          textItems: [],
          x: 0,
          y: 0,
        },
        {
          image: rasterImage(48, 48),
          textItems: [],
          x: -64,
          y: 120,
        },
        {
          image: rasterImage(100, 24),
          textItems: [],
          x: 50,
          y: 180,
        },
      ],
      200,
      160,
    );

    expect(bounds).toEqual({
      height: 204,
      maxX: 200,
      maxY: 204,
      minX: -64,
      minY: 0,
      width: 264,
    });
  });

  test("offsets vector text items for PDF layer placement", () => {
    expect(
      offsetTextItems(
        [
          {
            fontStyle: "italic",
            fontWeight: 500,
            label: "a",
            size: 24,
            x: 10,
            y: 20,
          },
        ],
        32,
        -8,
      ),
    ).toEqual([
      {
        fontStyle: "italic",
        fontWeight: 500,
        label: "a",
        size: 24,
        x: 42,
        y: 12,
      },
    ]);
  });
});

function rasterImage(width: number, height: number) {
  return {
    blob: new Blob(["image"]),
    height,
    width,
  };
}
