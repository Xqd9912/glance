import { describe, expect, test } from "bun:test";

import type { AtomSpec } from "../src/api/scene";
import {
  COLOR_SCHEMES,
  COLOR_SCHEME_OPTIONS,
  DEFAULT_COLOR_SCHEME_ID,
  autoDistinctElementColorOverrides,
  buildColormapCatalog,
  colorSchemeTokenStyle,
  elementColorForScheme,
  hasElementColor,
} from "../src/app/colorSchemes";
import { elementRadiusSymbols } from "../src/app/elementRadii";

describe("color schemes", () => {
  test("loads bundled colormaps from catalog data", () => {
    expect(DEFAULT_COLOR_SCHEME_ID).toBe("vesta-soft");
    expect(COLOR_SCHEMES.map((colormap) => colormap.id)).toEqual([
      "vesta-soft",
      "vesta",
      "jmol-soft",
      "jmol",
    ]);
    expect(COLOR_SCHEME_OPTIONS.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: "VESTA Soft", value: "vesta-soft" },
      { label: "VESTA", value: "vesta" },
      { label: "Jmol Soft", value: "jmol-soft" },
      { label: "Jmol", value: "jmol" },
    ]);
  });

  test("orders softened schemes before their source schemes", () => {
    expect(COLOR_SCHEME_OPTIONS.map((option) => option.value)).toEqual([
      "vesta-soft",
      "vesta",
      "jmol-soft",
      "jmol",
    ]);
  });

  test("derives token styles from catalog token elements", () => {
    expect(colorSchemeTokenStyle("vesta-soft")).toEqual({
      background:
        "linear-gradient(90deg, #f2c0c0 0% 25%, #8d5434 25% 50%, #a9b3df 50% 75%, #e15949 75% 100%)",
    });
    expect(COLOR_SCHEME_OPTIONS[0]?.tokenStyle).toEqual(
      colorSchemeTokenStyle("vesta-soft"),
    );
  });

  test("cover every frontend element radius symbol", () => {
    const radiusElements = elementRadiusSymbols();

    for (const { value } of COLOR_SCHEME_OPTIONS) {
      const missingElements = radiusElements.filter(
        (element) => !hasElementColor(element, value),
      );

      expect(missingElements).toEqual([]);
    }
  });

  test("define Jmol colors for registry-only placeholders", () => {
    expect(elementColorForScheme("D", "jmol")).toBe("#ffffff");
    expect(elementColorForScheme("XX", "jmol")).toBe("#4c4c4c");
  });

  test("defines softened Jmol Soft colors", () => {
    expect(elementColorForScheme("H", "jmol-soft")).toBe("#dedede");
    expect(elementColorForScheme("N", "jmol-soft")).toBe("#4769d6");
    expect(elementColorForScheme("O", "jmol-soft")).toBe("#e15a4b");
  });

  test("defines softened VESTA Soft colors", () => {
    expect(elementColorForScheme("O", "vesta-soft")).toBe("#e15949");
    expect(elementColorForScheme("Cl", "vesta-soft")).toBe("#87e17c");
    expect(elementColorForScheme("Si", "vesta-soft")).toBe("#3a61cf");
  });

  test("auto-distinguishes only lower-priority similar element colors", () => {
    const atoms = atomsWithElements(["O", "V"]);

    expect(autoDistinctElementColorOverrides(atoms, "vesta-soft", false)).toBeUndefined();

    const overrides = autoDistinctElementColorOverrides(atoms, "vesta-soft", true);
    expect(overrides?.O).toBeUndefined();
    expect(overrides?.V).toBeDefined();
    expect(overrides?.V).not.toBe(elementColorForScheme("V", "vesta-soft"));
  });

  test("auto-distinguishes same-hue VESTA Soft blues such as calcium and titanium", () => {
    const overrides = autoDistinctElementColorOverrides(
      atomsWithElements(["Ca", "Ti"]),
      "vesta-soft",
      true,
    );

    expect(overrides?.Ti).toBeUndefined();
    expect(overrides?.Ca).toBeDefined();
    expect(overrides?.Ca).not.toBe(elementColorForScheme("Ca", "vesta-soft"));
  });

  test("builds split colormap files in catalog order", () => {
    const catalog = buildColormapCatalog(
      {
        colormaps: [
          {
            file: "custom-soft.json",
            id: "custom-soft",
            label: "Custom Soft",
            tokenElements: ["H", "O"],
          },
          {
            file: "custom.json",
            id: "custom",
            label: "Custom",
            tokenElements: ["H", "O"],
          },
        ],
        defaultColorSchemeId: "custom-soft",
        version: 1,
      },
      {
        "../data/colormaps/presets/custom.json": validColormap({ name: "custom" }),
        "../data/colormaps/presets/custom-soft.json": validColormap({
          name: "custom-soft",
        }),
      },
    );

    expect(catalog.defaultColorSchemeId).toBe("custom-soft");
    expect(catalog.colormaps.map((colormap) => colormap.id)).toEqual([
      "custom-soft",
      "custom",
    ]);
  });

  test("rejects colormap files not listed in catalog", () => {
    expect(() =>
      buildColormapCatalog(
        {
          colormaps: [
            {
              file: "custom.json",
              id: "custom",
              label: "Custom",
              tokenElements: ["H", "O"],
            },
          ],
          defaultColorSchemeId: "custom",
          version: 1,
        },
        {
          "../data/colormaps/presets/custom.json": validColormap({ name: "custom" }),
          "../data/colormaps/presets/extra.json": validColormap({ name: "extra" }),
        },
      ),
    ).toThrow('Bundled colormap file "extra.json" is not listed');
  });

  test("rejects catalog token elements with no color", () => {
    expect(() =>
      buildColormapCatalog(
        {
          colormaps: [
            {
              file: "custom.json",
              id: "custom",
              label: "Custom",
              tokenElements: ["H", "Si"],
            },
          ],
          defaultColorSchemeId: "custom",
          version: 1,
        },
        {
          "../data/colormaps/presets/custom.json": validColormap({ name: "custom" }),
        },
      ),
    ).toThrow('token element "Si" has no color');
  });
});

function validColormap(patch: Record<string, unknown> = {}) {
  return {
    elements: {
      H: "#ffffff",
      O: "#ff0000",
    },
    name: "custom",
    ...patch,
  };
}

function atomsWithElements(elements: string[]): AtomSpec[] {
  return elements.map((element, index) => ({
    element,
    id: `${element}-${index}`,
    siteId: `${element}-${index}`,
    siteIndex: index,
    position: [index, 0, 0] as [number, number, number],
    fractionalPosition: [index, 0, 0] as [number, number, number],
    imageOffset: [0, 0, 0] as [number, number, number],
    isPeriodicImage: false,
    imageReasons: [],
    visibilityDependencies: [],
    visibilityDependencyGroups: [],
  }));
}
