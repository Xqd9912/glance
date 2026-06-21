import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Box3, BufferGeometry, CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

import type { AtomSpec, BondSpec, SceneSpec } from "../api/scene";

const elementColors: Record<string, string> = {
  Cl: "#88b04b",
  Na: "#5f8dd3",
};

export function LatticeScene({ scene }: { scene: SceneSpec }) {
  return (
    <Canvas
      orthographic
      camera={{
        position: scene.view.camera.position,
        zoom: 72,
        near: 0.1,
        far: 1000,
      }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      data-testid="lattice-canvas"
    >
      <color attach="background" args={["#f7f8f4"]} />
      <ambientLight intensity={0.62} />
      <directionalLight position={[5, 7, 9]} intensity={2.4} />
      <directionalLight position={[-4, -3, 2]} intensity={0.8} />
      <ResponsiveCamera position={scene.view.camera.position} target={scene.view.camera.target} />
      <group position={[-1.6, -1.2, -0.6]} rotation={[-0.18, 0.48, 0.0]}>
        <CellFrame vectors={scene.cell.vectors} />
        {scene.bonds.map((bond) => (
          <Bond key={`${bond.from}-${bond.to}`} atoms={scene.atoms} bond={bond} />
        ))}
        {scene.atoms.map((atom) => (
          <Atom key={atom.id} atom={atom} />
        ))}
      </group>
    </Canvas>
  );
}

function ResponsiveCamera({
  position,
  target,
}: {
  position: [number, number, number];
  target: [number, number, number];
}) {
  const { camera, size } = useThree();

  useEffect(() => {
    camera.position.set(...position);
    camera.lookAt(...target);

    if ("zoom" in camera) {
      camera.zoom = Math.min(72, Math.max(38, size.width / 9.5));
      camera.updateProjectionMatrix();
    }
  }, [camera, position, size.width, target]);

  return null;
}

function Atom({ atom }: { atom: AtomSpec }) {
  return (
    <mesh position={atom.position}>
      <sphereGeometry args={[atom.radius, 48, 32]} />
      <meshStandardMaterial
        color={elementColors[atom.element] ?? "#c9ced6"}
        roughness={0.42}
        metalness={0.04}
      />
    </mesh>
  );
}

function Bond({ atoms, bond }: { atoms: AtomSpec[]; bond: BondSpec }) {
  const geometry = useMemo(() => {
    const from = atoms.find((atom) => atom.id === bond.from);
    const to = atoms.find((atom) => atom.id === bond.to);

    if (!from || !to) {
      return new BufferGeometry();
    }

    const curve = new CatmullRomCurve3([
      new Vector3(...from.position),
      new Vector3(...to.position),
    ]);

    return new TubeGeometry(curve, 18, 0.06, 12, false);
  }, [atoms, bond.from, bond.to]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#7d858c" roughness={0.64} />
    </mesh>
  );
}

function CellFrame({ vectors }: { vectors: [number, number, number][] }) {
  const edges = useMemo(() => {
    const [vectorA = [3.2, 0, 0], vectorB = [0, 3.2, 0], vectorC = [0, 0, 3.2]] = vectors;
    const origin = new Vector3(0, 0, 0);
    const a = new Vector3(...vectorA);
    const b = new Vector3(...vectorB);
    const c = new Vector3(...vectorC);
    const points = [origin, a, b, c, a.clone().add(b), a.clone().add(c), b.clone().add(c), a.clone().add(b).add(c)];
    const box = new Box3().setFromPoints(points);
    const min = box.min;
    const max = box.max;

    return [
      [min.x, min.y, min.z, max.x, min.y, min.z],
      [min.x, max.y, min.z, max.x, max.y, min.z],
      [min.x, min.y, max.z, max.x, min.y, max.z],
      [min.x, max.y, max.z, max.x, max.y, max.z],
      [min.x, min.y, min.z, min.x, max.y, min.z],
      [max.x, min.y, min.z, max.x, max.y, min.z],
      [min.x, min.y, max.z, min.x, max.y, max.z],
      [max.x, min.y, max.z, max.x, max.y, max.z],
      [min.x, min.y, min.z, min.x, min.y, max.z],
      [max.x, min.y, min.z, max.x, min.y, max.z],
      [min.x, max.y, min.z, min.x, max.y, max.z],
      [max.x, max.y, min.z, max.x, max.y, max.z],
    ] as const;
  }, [vectors]);

  return (
    <group>
      {edges.map((edge, index) => (
        <CellEdge key={index} edge={edge} />
      ))}
    </group>
  );
}

function CellEdge({ edge }: { edge: readonly [number, number, number, number, number, number] }) {
  const geometry = useMemo(
    () =>
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(edge[0], edge[1], edge[2]),
          new Vector3(edge[3], edge[4], edge[5]),
        ]),
        4,
        0.018,
        8,
        false,
      ),
    [edge],
  );

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#30363d" roughness={0.5} />
    </mesh>
  );
}
