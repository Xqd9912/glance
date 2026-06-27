export type RenderBackend = "webgl" | "webgpu";

export interface RenderBackendOption {
  label: string;
  value: RenderBackend;
}

export const DEFAULT_RENDER_BACKEND: RenderBackend = "webgl";
export const RENDER_BACKEND_OPTIONS: readonly RenderBackendOption[] = [
  {
    label: "WebGL",
    value: "webgl",
  },
  {
    label: "WebGPU",
    value: "webgpu",
  },
];
