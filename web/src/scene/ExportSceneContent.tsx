import { useLayoutEffect } from "react";
import { OrthographicCamera } from "three";
import { useThree } from "@react-three/fiber";

import type { SceneSpec } from "../api/scene";
import type {
  ComponentOpacityState,
  PeriodicCellRange,
  MeasurementRecord,
  StyleState,
  UnitCellLineStyle,
} from "../model";
import type { CameraPoseSnapshot } from "./cameraPose";
import { applyCameraPoseSnapshot } from "./cameraPose";
import type { ResolvedStructureMaterialFamilies } from "./materialPresetResolver";
import type { SceneLayout } from "./sceneLayout";
import type { SceneMeshDetail } from "./StructureSceneObjects";
import { MemoizedStructureSceneObjects, SceneFog } from "./StructureSceneObjects";
import { applyOrthographicExportFrame, type StructureExportFramePlan } from "./exportFrame";

export function ExportSceneContent({
  cameraPose,
  cellRange,
  componentOpacity,
  exportFramePlan,
  layout,
  materialFamilies,
  meshDetail,
  measurements = [],
  polyhedronEdgeLineWidthScale = 1,
  scene,
  siteColorOverrides,
  showAtoms,
  showUnitCell,
  style,
  unitCellLineColor,
  unitCellLineStyle = "solid",
  unitCellLineWidthScale = 1,
}: {
  cameraPose: CameraPoseSnapshot;
  cellRange?: PeriodicCellRange;
  componentOpacity: ComponentOpacityState;
  exportFramePlan: StructureExportFramePlan;
  layout: SceneLayout;
  materialFamilies: ResolvedStructureMaterialFamilies;
  meshDetail: SceneMeshDetail;
  measurements?: readonly MeasurementRecord[];
  polyhedronEdgeLineWidthScale?: number;
  scene: SceneSpec;
  siteColorOverrides?: ReadonlyMap<number, string>;
  showAtoms: boolean;
  showUnitCell: boolean;
  style: StyleState;
  unitCellLineColor?: string;
  unitCellLineStyle?: UnitCellLineStyle;
  unitCellLineWidthScale?: number;
}) {
  const { camera } = useThree();

  useLayoutEffect(() => {
    applyCameraPoseSnapshot(camera, cameraPose, layout.standardPose.distance, layout.span);
  }, [camera, cameraPose, layout.span, layout.standardPose.distance]);

  useLayoutEffect(() => {
    if (camera instanceof OrthographicCamera) {
      applyOrthographicExportFrame(camera, exportFramePlan);
    }
  }, [camera, exportFramePlan]);

  return (
    <>
      <SceneFog layout={layout} style={style} />
      <MemoizedStructureSceneObjects
        cellRange={cellRange}
        componentOpacity={componentOpacity}
        groupPosition={layout.groupPosition}
        materialFamilies={materialFamilies}
        meshDetail={meshDetail}
        measurements={measurements}
        polyhedronEdgeLineWidthScale={polyhedronEdgeLineWidthScale}
        scene={scene}
        siteColorOverrides={siteColorOverrides}
        showAtoms={showAtoms}
        showUnitCell={showUnitCell}
        style={style}
        unitCellLineColor={unitCellLineColor}
        unitCellLineStyle={unitCellLineStyle}
        unitCellLineWidthScale={unitCellLineWidthScale}
      />
    </>
  );
}
