import { describe, expect, test } from "bun:test";

import type { SceneSpec } from "../src/api/scene";
import { deriveElementLegendEntries } from "../src/app/elementLegend";

describe("deriveElementLegendEntries", () => {
  test("keeps unique elements in first-seen order", () => {
    expect(
      deriveElementLegendEntries(
        sceneWithAtoms([
          ["Na", "#fadd3d"],
          ["Cl", "#1ff01f"],
          ["Na", "#000000"],
          ["O", "#ff0300"],
        ]),
      ),
    ).toEqual([
      { color: "#fadd3d", element: "Na" },
      { color: "#1ff01f", element: "Cl" },
      { color: "#ff0300", element: "O" },
    ]);
  });

  test("returns no legend entries without a loaded scene", () => {
    expect(deriveElementLegendEntries(null)).toEqual([]);
  });

  test("returns no legend entries for a scene without atoms", () => {
    expect(deriveElementLegendEntries(sceneWithAtoms([]))).toEqual([]);
  });
});

function sceneWithAtoms(atoms: Array<[string, string]>): SceneSpec {
  return {
    atoms: atoms.map(([element, color], index) => ({
      color,
      element,
      id: `${element}-${index}`,
      position: [index, 0, 0],
      radius: 1,
    })),
    cell: {
      vectors: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
    },
    summary: {
      atomCount: atoms.length,
      cell: {
        a: "1.00",
        alpha: "90.00",
        b: "1.00",
        beta: "90.00",
        c: "1.00",
        gamma: "90.00",
      },
      formula: "-",
      symmetry: {
        available: false,
        crystalSystem: null,
        latticeSystem: null,
        pointGroup: null,
        pointGroupSchoenflies: null,
        spaceGroup: null,
        spaceGroupNumber: null,
      },
    },
  };
}
