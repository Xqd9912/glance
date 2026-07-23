import { describe, expect, test } from "bun:test";

import type { AtomSpec, SceneSpec } from "../src/api/scene";
import {
  PROPERTY_BOND_MEAN,
  PROPERTY_COORDINATION,
  PROPERTY_COORDINATION_ELEMENT_PREFIX,
  interpolatePalette,
  matchingSiteIndices,
  scalarSiteColors,
  staticSceneAtomProperties,
  type PropertyFilterCondition,
} from "../src/model";

describe("atomic scalar properties", () => {
  test("derives coordination and bond distances from raw topology", () => {
    const properties = staticSceneAtomProperties(propertyScene(), [
      PROPERTY_COORDINATION,
      `${PROPERTY_COORDINATION_ELEMENT_PREFIX}O`,
      PROPERTY_BOND_MEAN,
    ]);
    expect(properties[PROPERTY_COORDINATION]?.values).toEqual([1, 2, 1]);
    expect(properties[`${PROPERTY_COORDINATION_ELEMENT_PREFIX}O`]?.values).toEqual([1, 0, 1]);
    expect(properties[PROPERTY_BOND_MEAN]?.values).toEqual([1, 1.5, 2]);
    expect(properties[PROPERTY_BOND_MEAN]?.domain).toEqual({ min: 1, max: 2 });
  });

  test("combines filter conditions with AND/OR and pauses on missing data", () => {
    const properties = staticSceneAtomProperties(propertyScene(), [
      PROPERTY_COORDINATION,
      PROPERTY_BOND_MEAN,
    ]);
    const conditions: PropertyFilterCondition[] = [
      { id: "coord", propertyId: PROPERTY_COORDINATION, operator: "gte", value: 2 },
      { id: "distance", propertyId: PROPERTY_BOND_MEAN, operator: "between", value: 1.4, upperValue: 2.1 },
    ];
    expect(matchingSiteIndices(properties, conditions, "and")).toEqual(new Set([1]));
    expect(matchingSiteIndices(properties, conditions, "or")).toEqual(new Set([1, 2]));
    expect(matchingSiteIndices(properties, [
      { ...conditions[0]!, propertyId: "missing" },
    ], "and")).toBeNull();
  });

  test("maps finite values through palettes and missing values to neutral gray", () => {
    const colors = scalarSiteColors({
      propertyId: "test",
      label: "Test",
      unit: "Å",
      values: [0, 0.5, 1, null],
      domain: { min: 0, max: 1 },
    }, "viridis");
    expect(colors.get(0)).toBe(interpolatePalette("viridis", 0));
    expect(colors.get(2)).toBe(interpolatePalette("viridis", 1));
    expect(colors.get(3)).toBe("#9ca3af");
    const invalidManual = scalarSiteColors({
      propertyId: "test", label: "Test", unit: "", values: [0, 1],
      domain: { min: 0, max: 1 },
    }, "viridis", { min: 2, max: 1 });
    expect(invalidManual.get(0)).toBe(interpolatePalette("viridis", 0));
  });
});

function propertyScene(): SceneSpec {
  const atoms = [
    atom("H-0", 0, "H", [0, 0, 0]),
    atom("O-1", 1, "O", [1, 0, 0]),
    atom("H-2", 2, "H", [3, 0, 0]),
  ];
  return {
    cell: { vectors: [[10, 0, 0], [0, 10, 0], [0, 0, 10]], periodic: false },
    atoms,
    bonds: [
      { startAtomIndex: 0, endAtomIndex: 1, visibilityDependencies: [], visibilityDependencyGroups: [] },
      { startAtomIndex: 1, endAtomIndex: 2, visibilityDependencies: [], visibilityDependencyGroups: [] },
    ],
    polyhedra: [],
    summary: {
      formula: "H2O",
      atomCount: 3,
      cell: { a: "10", b: "10", c: "10", alpha: "90", beta: "90", gamma: "90" },
      symmetry: {
        available: false, spaceGroup: null, spaceGroupNumber: null,
        pointGroup: null, pointGroupSchoenflies: null, crystalSystem: null, latticeSystem: null,
      },
    },
    bondCutoffs: [],
  };
}

function atom(
  id: string,
  siteIndex: number,
  element: string,
  position: [number, number, number],
): AtomSpec {
  return {
    id, siteId: id, siteIndex, element, position,
    fractionalPosition: position.map((value) => value / 10) as [number, number, number],
    imageOffset: [0, 0, 0], isPeriodicImage: false, imageReasons: [],
    visibilityDependencies: [], visibilityDependencyGroups: [],
  };
}
