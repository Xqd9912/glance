import type { SceneSpec } from "../api/scene";

export type PreviewStatus = "idle" | "loading" | "ready" | "error";

export interface StructureSummary {
  atomCount: number;
  elementSummary: string;
  cellVectorCount: number;
}

export function summarizeScene(scene: SceneSpec | null): StructureSummary {
  if (!scene) {
    return {
      atomCount: 0,
      elementSummary: "-",
      cellVectorCount: 0,
    };
  }

  const elements = Array.from(new Set(scene.atoms.map((atom) => atom.element))).sort();
  const visibleElements = elements.slice(0, 5).join(", ");
  const overflow = elements.length > 5 ? ` +${elements.length - 5}` : "";

  return {
    atomCount: scene.atoms.length,
    elementSummary: `${visibleElements}${overflow}`,
    cellVectorCount: scene.cell.vectors.length,
  };
}

export function previewStatusLabel(status: PreviewStatus): string {
  if (status === "idle") {
    return "Idle";
  }
  if (status === "loading") {
    return "Loading";
  }
  if (status === "ready") {
    return "Ready";
  }
  return "Error";
}
