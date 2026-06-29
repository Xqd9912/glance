import { memo, useEffect, useMemo } from "react";
import {
  DoubleSide,
  EdgesGeometry,
} from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

import type {
  AtomSpec,
  PolyhedronSpec,
} from "../api/scene";
import {
  atomColorForScheme,
  type ElementColorOverrides,
} from "../model/colorSchemes";
import type { StyleState } from "../model";
import { StructureMaterial } from "./StructureMaterial";
import type { ResolvedStructureMaterialFamily } from "./materialPresetResolver";
import { polyhedronGeometryFromAtoms } from "./structureGeometry";

export const POLYHEDRON_SURFACE_OPACITY = 0.5;
export const POLYHEDRON_EDGE_COLOR = "#f2f5f9";
export const POLYHEDRON_EDGE_LINE_WIDTH_PIXELS = 1;
export const POLYHEDRON_EDGE_OPACITY = 0.8;
const POLYHEDRON_EDGE_OPACITY_RATIO =
  POLYHEDRON_EDGE_OPACITY / POLYHEDRON_SURFACE_OPACITY;

function PolyhedronMesh({
  atoms,
  colorScheme,
  colorOverrides,
  lineWidthScale,
  materialFamily,
  opacity,
  polyhedron,
}: {
  atoms: AtomSpec[];
  colorScheme: StyleState["colorScheme"];
  colorOverrides?: ElementColorOverrides;
  lineWidthScale: number;
  materialFamily: ResolvedStructureMaterialFamily;
  opacity: number;
  polyhedron: PolyhedronSpec;
}) {
  const geometry = useMemo(
    () => polyhedronGeometryFromAtoms(polyhedron, atoms),
    [atoms, polyhedron],
  );
  const centerAtom = atoms[polyhedron.centerAtomIndex];
  const color = centerAtom
    ? atomColorForScheme(centerAtom, colorScheme, colorOverrides)
    : POLYHEDRON_EDGE_COLOR;
  const edgeLine = useMemo(() => {
    if (!geometry) {
      return null;
    }

    const edgeGeometry = new EdgesGeometry(geometry);
    const edgePositions = edgeGeometry.getAttribute("position");
    const lineGeometry = new LineSegmentsGeometry();
    lineGeometry.setPositions(Array.from(edgePositions.array));
    edgeGeometry.dispose();

    const material = new LineMaterial({
      alphaToCoverage: true,
      color: POLYHEDRON_EDGE_COLOR,
      depthWrite: false,
      fog: false,
      linewidth: POLYHEDRON_EDGE_LINE_WIDTH_PIXELS * lineWidthScale,
      opacity: Math.min(1, opacity * POLYHEDRON_EDGE_OPACITY_RATIO),
      transparent: true,
      worldUnits: false,
    });

    return new LineSegments2(lineGeometry, material);
  }, [geometry, lineWidthScale, opacity]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    return () => {
      edgeLine?.geometry.dispose();
      edgeLine?.material.dispose();
    };
  }, [edgeLine]);

  if (!geometry || !centerAtom || !edgeLine) {
    return null;
  }

  return (
    <group>
      <mesh geometry={geometry}>
        <StructureMaterial
          color={color}
          depthWrite={false}
          materialFamily={materialFamily}
          opacity={opacity}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <primitive object={edgeLine} />
    </group>
  );
}

export const MemoizedPolyhedronMesh = memo(PolyhedronMesh);
