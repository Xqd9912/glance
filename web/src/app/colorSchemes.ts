import type { AtomSpec } from "../api/scene";
import jmolColormap from "../data/colormaps/jmol.json";
import vestaColormap from "../data/colormaps/vesta.json";

export type ColorScheme = "vesta" | "jmol";

interface ColormapData {
  name: ColorScheme;
  elements: Record<string, string>;
}

const COLOR_SCHEMES: Record<ColorScheme, ColormapData> = {
  vesta: vestaColormap as ColormapData,
  jmol: jmolColormap as ColormapData,
};

export const COLOR_SCHEME_OPTIONS: { label: string; value: ColorScheme }[] = [
  { label: "VESTA", value: "vesta" },
  { label: "Jmol", value: "jmol" },
];

export function atomColorForScheme(atom: AtomSpec, colorScheme: ColorScheme): string {
  return elementColorForScheme(atom.element, colorScheme);
}

export function hasElementColor(element: string, colorScheme: ColorScheme): boolean {
  return COLOR_SCHEMES[colorScheme].elements[element] !== undefined;
}

export function elementColorForScheme(
  element: string,
  colorScheme: ColorScheme,
): string {
  const color = COLOR_SCHEMES[colorScheme].elements[element];
  if (color === undefined) {
    throw new Error(`No ${colorScheme} color is defined for element ${element}.`);
  }
  return color;
}
