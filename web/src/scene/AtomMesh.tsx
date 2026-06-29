import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Color,
  Group,
  SpriteMaterial,
} from "three";

import type {
  AtomRadiusModel,
  AtomSpec,
} from "../api/scene";
import {
  atomColorForScheme,
  type ElementColorOverrides,
} from "../model/colorSchemes";
import type { StyleState } from "../model";
import { atomRadiusForModel } from "./sceneGeometry";
import { StructureMaterial, type StructureMeshMaterial } from "./StructureMaterial";
import { AtomSelectionRing } from "./AtomSelectionRing";
import type { SceneMeshDetail } from "./StructureSceneObjects";
import type { ResolvedStructureMaterialFamily } from "./materialPresetResolver";
import {
  ATOM_SELECTION_RING_PULSE_MIN_SCALE,
  ATOM_SELECTION_RING_SELECTED_OPACITY,
  ATOM_SELECTION_RING_SELECTED_SCALE,
  ATOM_HIGHLIGHT_PULSE_COLOR_MIX,
  ATOM_HIGHLIGHT_PULSE_EMISSIVE_INTENSITY,
  ATOM_HIGHLIGHT_PULSE_MS,
  ATOM_HIGHLIGHT_SELECT_MS,
  ATOM_HIGHLIGHT_SELECTED_COLOR_MIX,
  ATOM_HIGHLIGHT_SELECTED_EMISSIVE_INTENSITY,
  applyAtomHighlight,
  atomPulseFade,
  easeOutCubic,
} from "./atomHighlight";

interface AtomSelectionHighlightTransition {
  startColorMix: number;
  startEmissiveIntensity: number;
  startRingOpacity: number;
  startRingScale: number;
  startTimeMs: number;
}

function AtomMesh({
  atom,
  colorScheme,
  colorOverrides,
  inspected,
  interactionLocked,
  materialFamily,
  meshDetail,
  onInspect,
  onPulse,
  onLockedInteractionAttempt,
  opacity,
  pulseToken,
  radiusModel,
  radiusScale,
}: {
  atom: AtomSpec;
  colorScheme: StyleState["colorScheme"];
  colorOverrides?: ElementColorOverrides;
  inspected: boolean;
  interactionLocked: boolean;
  materialFamily: ResolvedStructureMaterialFamily;
  meshDetail: SceneMeshDetail;
  onInspect?: (atomId: string | null) => void;
  onPulse?: (atomId: string) => void;
  onLockedInteractionAttempt?: () => void;
  opacity: number;
  pulseToken: number;
  radiusModel: AtomRadiusModel;
  radiusScale: number;
}) {
  const atomMaterialRef = useRef<StructureMeshMaterial | null>(null);
  const ringMaterialRef = useRef<SpriteMaterial | null>(null);
  const ringGroupRef = useRef<Group | null>(null);
  const currentColorMixRef = useRef(0);
  const currentEmissiveIntensityRef = useRef(0);
  const currentRingOpacityRef = useRef(0);
  const currentRingScaleRef = useRef(ATOM_SELECTION_RING_PULSE_MIN_SCALE);
  const handledPulseTokenRef = useRef(0);
  const pulseStartTimeRef = useRef<number | null>(null);
  const selectionTransitionRef = useRef<AtomSelectionHighlightTransition | null>(null);
  const [isHighlightAnimationActive, setIsHighlightAnimationActive] = useState(false);
  const isTransparent = opacity < 1;
  const radius = atomRadiusForModel(atom, radiusModel);
  const scaledRadius = radius * radiusScale;
  const color = atomColorForScheme(atom, colorScheme, colorOverrides);
  const baseColor = useMemo(() => new Color(color), [color]);

  const resetHighlight = useCallback(() => {
    currentColorMixRef.current = 0;
    currentEmissiveIntensityRef.current = 0;
    currentRingOpacityRef.current = 0;
    currentRingScaleRef.current = ATOM_SELECTION_RING_PULSE_MIN_SCALE;

    const atomMaterial = atomMaterialRef.current;
    if (atomMaterial) {
      applyAtomHighlight(atomMaterial, baseColor, 0, 0);
    }

    const ringMaterial = ringMaterialRef.current;
    const ringGroup = ringGroupRef.current;
    if (ringMaterial && ringGroup) {
      ringGroup.scale.setScalar(ATOM_SELECTION_RING_PULSE_MIN_SCALE);
      ringMaterial.opacity = 0;
    }
  }, [baseColor]);

  useEffect(() => {
    if (pulseToken === 0) {
      handledPulseTokenRef.current = 0;
      pulseStartTimeRef.current = null;
      if (!inspected) {
        resetHighlight();
        setIsHighlightAnimationActive(false);
      }
      return;
    }

    if (pulseToken === handledPulseTokenRef.current) {
      return;
    }

    handledPulseTokenRef.current = pulseToken;
    pulseStartTimeRef.current = performance.now();
    setIsHighlightAnimationActive(true);
  }, [inspected, pulseToken, resetHighlight]);

  useEffect(() => {
    if (!inspected) {
      selectionTransitionRef.current = null;
      if (pulseStartTimeRef.current === null) {
        resetHighlight();
        setIsHighlightAnimationActive(false);
      }
      return;
    }

    selectionTransitionRef.current = {
      startColorMix: currentColorMixRef.current,
      startEmissiveIntensity: currentEmissiveIntensityRef.current,
      startRingOpacity: currentRingOpacityRef.current,
      startRingScale: currentRingScaleRef.current,
      startTimeMs: performance.now(),
    };
    pulseStartTimeRef.current = null;
    setIsHighlightAnimationActive(true);
  }, [baseColor, inspected, resetHighlight]);

  const handleHighlightAnimationComplete = useCallback(() => {
    setIsHighlightAnimationActive(false);
  }, []);

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      if (interactionLocked) {
        return;
      }

      onPulse?.(atom.id);
    },
    [atom.id, interactionLocked, onPulse],
  );

  const handleDoubleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      if (interactionLocked) {
        onLockedInteractionAttempt?.();
        return;
      }

      onInspect?.(atom.id);
    },
    [atom.id, interactionLocked, onInspect, onLockedInteractionAttempt],
  );

  return (
    <group position={atom.position}>
      {inspected ? (
        <AtomSelectionRing
          materialRef={ringMaterialRef}
          opacity={0}
          radius={scaledRadius}
          ringRef={ringGroupRef}
          scale={ATOM_SELECTION_RING_PULSE_MIN_SCALE}
        />
      ) : null}
      <mesh
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <sphereGeometry
          args={[
            scaledRadius,
            meshDetail.sphereWidthSegments,
            meshDetail.sphereHeightSegments,
          ]}
        />
        <StructureMaterial
          color={color}
          depthWrite={!isTransparent}
          materialFamily={materialFamily}
          materialRef={atomMaterialRef}
          opacity={opacity}
          transparent={isTransparent}
        />
      </mesh>
      {isHighlightAnimationActive ? (
        <AtomHighlightAnimator
          atomMaterialRef={atomMaterialRef}
          baseColor={baseColor}
          currentColorMixRef={currentColorMixRef}
          currentEmissiveIntensityRef={currentEmissiveIntensityRef}
          currentRingOpacityRef={currentRingOpacityRef}
          currentRingScaleRef={currentRingScaleRef}
          ringMaterialRef={ringMaterialRef}
          ringGroupRef={ringGroupRef}
          inspected={inspected}
          onComplete={handleHighlightAnimationComplete}
          pulseStartTimeRef={pulseStartTimeRef}
          selectionTransitionRef={selectionTransitionRef}
        />
      ) : null}
    </group>
  );
}

function AtomHighlightAnimator({
  atomMaterialRef,
  baseColor,
  currentColorMixRef,
  currentEmissiveIntensityRef,
  currentRingOpacityRef,
  currentRingScaleRef,
  ringMaterialRef,
  ringGroupRef,
  inspected,
  onComplete,
  pulseStartTimeRef,
  selectionTransitionRef,
}: {
  atomMaterialRef: { current: StructureMeshMaterial | null };
  baseColor: Color;
  currentColorMixRef: { current: number };
  currentEmissiveIntensityRef: { current: number };
  currentRingOpacityRef: { current: number };
  currentRingScaleRef: { current: number };
  ringMaterialRef: { current: SpriteMaterial | null };
  ringGroupRef: { current: Group | null };
  inspected: boolean;
  onComplete: () => void;
  pulseStartTimeRef: { current: number | null };
  selectionTransitionRef: { current: AtomSelectionHighlightTransition | null };
}) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    invalidate();
  }, [invalidate]);

  useFrame(() => {
    const atomMaterial = atomMaterialRef.current;
    if (!atomMaterial) {
      return;
    }
    const ringMaterial = ringMaterialRef.current;
    const ringGroup = ringGroupRef.current;

    if (inspected) {
      const selectionTransition = selectionTransitionRef.current;
      if (!selectionTransition) {
        currentColorMixRef.current = ATOM_HIGHLIGHT_SELECTED_COLOR_MIX;
        currentEmissiveIntensityRef.current = ATOM_HIGHLIGHT_SELECTED_EMISSIVE_INTENSITY;
        currentRingOpacityRef.current = ATOM_SELECTION_RING_SELECTED_OPACITY;
        currentRingScaleRef.current = ATOM_SELECTION_RING_SELECTED_SCALE;
        applyAtomHighlight(
          atomMaterial,
          baseColor,
          ATOM_HIGHLIGHT_SELECTED_COLOR_MIX,
          ATOM_HIGHLIGHT_SELECTED_EMISSIVE_INTENSITY,
        );
        if (ringMaterial && ringGroup) {
          ringGroup.scale.setScalar(ATOM_SELECTION_RING_SELECTED_SCALE);
          ringMaterial.opacity = ATOM_SELECTION_RING_SELECTED_OPACITY;
        }
        onComplete();
        return;
      }

      const progress = Math.min(
        1,
        (performance.now() - selectionTransition.startTimeMs) / ATOM_HIGHLIGHT_SELECT_MS,
      );
      const easedProgress = easeOutCubic(progress);
      const colorMix =
        selectionTransition.startColorMix +
        (ATOM_HIGHLIGHT_SELECTED_COLOR_MIX - selectionTransition.startColorMix) *
          easedProgress;
      const emissiveIntensity =
        selectionTransition.startEmissiveIntensity +
        (ATOM_HIGHLIGHT_SELECTED_EMISSIVE_INTENSITY -
          selectionTransition.startEmissiveIntensity) *
          easedProgress;
      const ringOpacity =
        selectionTransition.startRingOpacity +
        (ATOM_SELECTION_RING_SELECTED_OPACITY - selectionTransition.startRingOpacity) *
          easedProgress;
      const ringScale =
        selectionTransition.startRingScale +
        (ATOM_SELECTION_RING_SELECTED_SCALE - selectionTransition.startRingScale) *
          easedProgress;
      currentColorMixRef.current = colorMix;
      currentEmissiveIntensityRef.current = emissiveIntensity;
      currentRingOpacityRef.current = ringOpacity;
      currentRingScaleRef.current = ringScale;
      applyAtomHighlight(atomMaterial, baseColor, colorMix, emissiveIntensity);
      if (ringMaterial && ringGroup) {
        ringGroup.scale.setScalar(ringScale);
        ringMaterial.opacity = ringOpacity;
      }

      if (progress >= 1) {
        selectionTransitionRef.current = null;
        onComplete();
      } else {
        invalidate();
      }
      return;
    }

    const pulseStartTime = pulseStartTimeRef.current;
    if (pulseStartTime === null) {
      currentColorMixRef.current = 0;
      currentEmissiveIntensityRef.current = 0;
      currentRingOpacityRef.current = 0;
      currentRingScaleRef.current = ATOM_SELECTION_RING_PULSE_MIN_SCALE;
      applyAtomHighlight(atomMaterial, baseColor, 0, 0);
      if (ringMaterial && ringGroup) {
        ringGroup.scale.setScalar(ATOM_SELECTION_RING_PULSE_MIN_SCALE);
        ringMaterial.opacity = 0;
      }
      onComplete();
      return;
    }

    const progress = Math.min(
      1,
      (performance.now() - pulseStartTime) / ATOM_HIGHLIGHT_PULSE_MS,
    );
    const fade = atomPulseFade(progress);
    const colorMix = ATOM_HIGHLIGHT_PULSE_COLOR_MIX * fade;
    const emissiveIntensity = ATOM_HIGHLIGHT_PULSE_EMISSIVE_INTENSITY * fade;
    currentColorMixRef.current = colorMix;
    currentEmissiveIntensityRef.current = emissiveIntensity;
    currentRingOpacityRef.current = 0;
    currentRingScaleRef.current = ATOM_SELECTION_RING_PULSE_MIN_SCALE;
    applyAtomHighlight(atomMaterial, baseColor, colorMix, emissiveIntensity);
    if (ringMaterial && ringGroup) {
      ringGroup.scale.setScalar(ATOM_SELECTION_RING_PULSE_MIN_SCALE);
      ringMaterial.opacity = 0;
    }

    if (progress >= 1) {
      pulseStartTimeRef.current = null;
      applyAtomHighlight(atomMaterial, baseColor, 0, 0);
      onComplete();
    } else {
      invalidate();
    }
  });

  return null;
}

export const MemoizedAtomMesh = memo(AtomMesh);
