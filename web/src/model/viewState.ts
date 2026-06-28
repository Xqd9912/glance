export type InteractionMode = "trackball" | "orbit";

export const MIN_VIEW_SCALE = 0.2;
export const MAX_VIEW_SCALE = 5;
export const DEFAULT_VIEW_SCALE = 1;
export const BASE_TRACKBALL_DRAG_SENSITIVITY = 2;
export const BASE_ORBIT_DRAG_SENSITIVITY = 0.5;
export const MIN_DRAG_SENSITIVITY = 0.5;
export const MAX_DRAG_SENSITIVITY = 2;
export const DEFAULT_DRAG_SENSITIVITY = 1;
export const DRAG_SENSITIVITY_SLIDER_SNAP_POSITION = 0.5;
export const DRAG_SENSITIVITY_SLIDER_SNAP_THRESHOLD = 0.04;
export const ZOOM_SLIDER_SNAP_POSITION = 0.5;
export const ZOOM_SLIDER_SNAP_THRESHOLD = 0.03;

export const INTERACTION_MODE_OPTIONS: readonly {
  label: string;
  value: InteractionMode;
}[] = [
  { label: "Trackball", value: "trackball" },
  { label: "Orbit", value: "orbit" },
];

export function clampViewScale(viewScale: number): number {
  if (!Number.isFinite(viewScale)) {
    return 1;
  }

  return Math.min(MAX_VIEW_SCALE, Math.max(MIN_VIEW_SCALE, viewScale));
}

export function clampDragSensitivity(dragSensitivity: number): number {
  if (!Number.isFinite(dragSensitivity)) {
    return DEFAULT_DRAG_SENSITIVITY;
  }

  return Math.min(
    MAX_DRAG_SENSITIVITY,
    Math.max(MIN_DRAG_SENSITIVITY, dragSensitivity),
  );
}

export function viewScaleToSliderPosition(viewScale: number): number {
  const clampedScale = clampViewScale(viewScale);
  const range = MAX_VIEW_SCALE / MIN_VIEW_SCALE;

  return Math.log(clampedScale / MIN_VIEW_SCALE) / Math.log(range);
}

export function sliderPositionToViewScale(position: number): number {
  const normalizedPosition = Math.min(1, Math.max(0, position));
  const range = MAX_VIEW_SCALE / MIN_VIEW_SCALE;

  return clampViewScale(MIN_VIEW_SCALE * range ** normalizedPosition);
}

export function dragSensitivityToSliderPosition(dragSensitivity: number): number {
  const clampedSensitivity = clampDragSensitivity(dragSensitivity);
  const range = MAX_DRAG_SENSITIVITY / MIN_DRAG_SENSITIVITY;

  return Math.log(clampedSensitivity / MIN_DRAG_SENSITIVITY) / Math.log(range);
}

export function sliderPositionToDragSensitivity(position: number): number {
  const normalizedPosition = Math.min(1, Math.max(0, position));
  const range = MAX_DRAG_SENSITIVITY / MIN_DRAG_SENSITIVITY;

  return clampDragSensitivity(MIN_DRAG_SENSITIVITY * range ** normalizedPosition);
}

export function snapDragSensitivitySliderPosition(position: number): number {
  if (
    Math.abs(position - DRAG_SENSITIVITY_SLIDER_SNAP_POSITION) <=
    DRAG_SENSITIVITY_SLIDER_SNAP_THRESHOLD
  ) {
    return DRAG_SENSITIVITY_SLIDER_SNAP_POSITION;
  }

  return position;
}

export function snapZoomSliderPosition(position: number): number {
  if (Math.abs(position - ZOOM_SLIDER_SNAP_POSITION) <= ZOOM_SLIDER_SNAP_THRESHOLD) {
    return ZOOM_SLIDER_SNAP_POSITION;
  }

  return position;
}

export function formatDragSensitivityPercent(dragSensitivity: number): string {
  return String(Math.round(clampDragSensitivity(dragSensitivity) * 100));
}

export function parseDragSensitivityPercentInput(value: string): number | null {
  const normalizedValue = value.trim().replace(/%$/, "");
  if (normalizedValue.length === 0) {
    return null;
  }

  const percent = Number(normalizedValue);
  if (!Number.isFinite(percent) || percent <= 0) {
    return null;
  }

  return clampDragSensitivity(percent / 100);
}

export function formatZoomPercent(viewScale: number): string {
  return String(Math.round(clampViewScale(viewScale) * 100));
}

export function parseZoomPercentInput(value: string): number | null {
  const normalizedValue = value.trim().replace(/%$/, "");
  if (normalizedValue.length === 0) {
    return null;
  }

  const percent = Number(normalizedValue);
  if (!Number.isFinite(percent) || percent <= 0) {
    return null;
  }

  return clampViewScale(percent / 100);
}
