/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GLANCE_STATIC_SCENE?: string;
  readonly VITE_GLANCE_STATIC_SCENE_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
