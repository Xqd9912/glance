import { Quaternion, Vector3 } from "three";

import type {
  AtomSpec,
  BondSpec,
} from "../api/scene";
import {
  atomColorForScheme,
  type ElementColorOverrides,
} from "../model/colorSchemes";
import type {
  BondColorMode,
  StyleState,
} from "../model";

const BOND_UP_AXIS = new Vector3(0, 1, 0);

export interface BondRenderItem {
  center: Vector3;
  endAtomIndex: number;
  endColor: string;
  length: number;
  quaternion: Quaternion;
  startAtomIndex: number;
  startColor: string;
}

export function createBondRenderItems({
  atoms,
  bondColor,
  bonds,
  colorMode,
  colorScheme,
  colorOverrides,
}: {
  atoms: AtomSpec[];
  bondColor: string;
  bonds: BondSpec[];
  colorMode: BondColorMode;
  colorScheme: StyleState["colorScheme"];
  colorOverrides?: ElementColorOverrides;
}): BondRenderItem[] {
  const items: BondRenderItem[] = [];

  for (const bond of bonds) {
    const startAtom = atoms[bond.startAtomIndex];
    const endAtom = atoms[bond.endAtomIndex];
    if (!startAtom || !endAtom) {
      continue;
    }

    const start = new Vector3(...startAtom.position);
    const end = new Vector3(...endAtom.position);
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length <= 0) {
      continue;
    }

    items.push({
      center: start.clone().add(end).multiplyScalar(0.5),
      endAtomIndex: bond.endAtomIndex,
      endColor:
        colorMode === "bicolor"
          ? atomColorForScheme(endAtom, colorScheme, colorOverrides)
          : bondColor,
      length,
      quaternion: new Quaternion().setFromUnitVectors(
        BOND_UP_AXIS,
        direction.clone().normalize(),
      ),
      startAtomIndex: bond.startAtomIndex,
      startColor:
        colorMode === "bicolor"
          ? atomColorForScheme(startAtom, colorScheme, colorOverrides)
          : bondColor,
    });
  }

  return items;
}
