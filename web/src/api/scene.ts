export interface SceneSpec {
  cell: {
    vectors: [number, number, number][];
  };
  atoms: AtomSpec[];
  bonds: BondSpec[];
  view: {
    projection: "orthographic";
    preset: string;
    camera: {
      position: [number, number, number];
      target: [number, number, number];
    };
  };
}

export interface AtomSpec {
  id: string;
  element: string;
  position: [number, number, number];
  radius: number;
}

export interface BondSpec {
  from: string;
  to: string;
}

export async function fetchDemoScene(): Promise<SceneSpec> {
  const response = await fetch("/api/demo-scene");

  if (!response.ok) {
    throw new Error(`Failed to load demo scene: ${response.status}`);
  }

  return (await response.json()) as SceneSpec;
}
