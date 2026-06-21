import { Download, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchDemoScene, type SceneSpec } from "../api/scene";
import { LatticeScene } from "../scene/LatticeScene";

type LoadState = "loading" | "ready" | "error";

export function App() {
  const [scene, setScene] = useState<SceneSpec | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  async function loadScene() {
    setLoadState("loading");
    try {
      const nextScene = await fetchDemoScene();
      setScene(nextScene);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }

  useEffect(() => {
    void loadScene();
  }, []);

  const summary = useMemo(() => {
    if (!scene) {
      return { atoms: "0", bonds: "0", preset: "..." };
    }

    return {
      atoms: scene.atoms.length.toString(),
      bonds: scene.bonds.length.toString(),
      preset: scene.view.preset,
    };
  }, [scene]);

  return (
    <main className="app-shell">
      <section className="scene-stage" aria-label="Crystal structure preview">
        {scene ? (
          <LatticeScene scene={scene} />
        ) : (
          <div className="scene-placeholder" data-state={loadState}>
            {loadState === "error" ? "Unable to load scene" : "Loading scene"}
          </div>
        )}
      </section>

      <aside className="workspace-panel" aria-label="Scene controls">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Pretty Lattice</p>
            <h1>Demo Crystal</h1>
          </div>
          <span className="status-pill" data-state={loadState}>
            {loadState}
          </span>
        </div>

        <div className="metric-grid">
          <div>
            <span>Atoms</span>
            <strong>{summary.atoms}</strong>
          </div>
          <div>
            <span>Bonds</span>
            <strong>{summary.bonds}</strong>
          </div>
        </div>

        <dl className="scene-meta">
          <div>
            <dt>View</dt>
            <dd>{summary.preset}</dd>
          </div>
          <div>
            <dt>Projection</dt>
            <dd>{scene?.view.projection ?? "orthographic"}</dd>
          </div>
        </dl>

        <div className="toolbar" aria-label="Preview actions">
          <button type="button" title="Reload demo scene" onClick={() => void loadScene()}>
            <RefreshCcw aria-hidden="true" size={18} />
            <span>Reload</span>
          </button>
          <button type="button" title="PNG export will be wired in a later slice" disabled>
            <Download aria-hidden="true" size={18} />
            <span>Export</span>
          </button>
        </div>
      </aside>
    </main>
  );
}
