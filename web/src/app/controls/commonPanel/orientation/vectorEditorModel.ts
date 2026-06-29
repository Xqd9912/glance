import {
  computeCrystalCameraVectors,
  parseVectorCoefficients,
  stateFromViewVectors,
} from "../../../../scene/crystalCamera";
import type {
  CrystalCameraScreenDirection,
  CrystalCameraState,
  VectorTuple,
} from "../../../../model";

import {
  SCREEN_AXIS_OPTIONS,
  draftFromCameraState,
  screenAxisLabel,
} from "./orientationControlMath";

export type VectorEditorDraftRow = "direct" | "reciprocal";

export interface VectorEditorDraft {
  direct: [string, string, string];
  reciprocal: [string, string, string];
}

export interface VectorEditorRowModel {
  basisLabels: readonly string[];
  draft: readonly string[];
  isPrimaryAxis: boolean;
  label: string;
  row: VectorEditorDraftRow;
  secondaryOptions?: readonly {
    direction: CrystalCameraScreenDirection;
    letter: "X" | "Y" | "Z";
    label: "Right" | "Up" | "Out";
  }[];
}

export function resetVectorEditorDraft(
  cameraState: CrystalCameraState,
): VectorEditorDraft {
  return draftFromCameraState(cameraState);
}

export function updateVectorEditorDraft(
  draft: VectorEditorDraft,
  row: VectorEditorDraftRow,
  index: number,
  value: string,
): VectorEditorDraft {
  if (index < 0 || index > 2) {
    return draft;
  }

  return {
    ...draft,
    [row]: draft[row].map((entry, entryIndex) =>
      entryIndex === index ? value : entry,
    ) as [string, string, string],
  };
}

export function cameraStateFromVectorEditorDraft({
  cameraState,
  cellVectors,
  draft,
}: {
  cameraState: CrystalCameraState;
  cellVectors: VectorTuple[];
  draft: VectorEditorDraft;
}): CrystalCameraState | null {
  const direct = parseVectorCoefficients(draft.direct);
  const reciprocal = parseVectorCoefficients(draft.reciprocal);
  if (!direct || !reciprocal) {
    return null;
  }

  const cameraVectors = computeCrystalCameraVectors(cellVectors, {
    ...cameraState,
    direct,
    reciprocal,
  });

  return stateFromViewVectors(
    cellVectors,
    cameraState.primary,
    cameraState.secondary,
    cameraVectors.up,
    cameraVectors.outward,
  );
}

export function vectorEditorRows(
  cameraState: CrystalCameraState,
  draft: VectorEditorDraft,
): readonly VectorEditorRowModel[] {
  const secondaryOptions = SCREEN_AXIS_OPTIONS.filter(
    (option) => option.direction !== cameraState.primary,
  );

  return [
    {
      basisLabels: ["a", "b", "c"],
      draft: draft.direct,
      isPrimaryAxis: true,
      label: screenAxisLabel(cameraState.primary),
      row: "direct",
    },
    {
      basisLabels: ["a*", "b*", "c*"],
      draft: draft.reciprocal,
      isPrimaryAxis: false,
      label: screenAxisLabel(cameraState.secondary),
      row: "reciprocal",
      secondaryOptions,
    },
  ] as const;
}
