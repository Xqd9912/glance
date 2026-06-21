import { FolderOpen } from "lucide-react";
import { type ChangeEvent, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { uploadStructurePreview, type SceneSpec } from "../api/scene";
import { LatticeScene } from "../scene/LatticeScene";
import { previewStatusLabel, summarizeScene, type PreviewStatus } from "./previewState";

const previewStatusClasses: Record<PreviewStatus, string> = {
  error: "border-destructive/20 bg-destructive/10 text-destructive",
  idle: "border-border bg-secondary text-muted-foreground",
  loading: "border-neutral-300 bg-neutral-100 text-neutral-800",
  ready: "border-neutral-900 bg-neutral-900 text-white",
};

export function App() {
  const [scene, setScene] = useState<SceneSpec | null>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setSelectedFileName(file.name);
    setPreviewStatus("loading");
    setErrorMessage(null);
    setScene(null);

    try {
      const nextScene = await uploadStructurePreview(file);
      setScene(nextScene);
      setPreviewStatus("ready");
    } catch (error) {
      setScene(null);
      setPreviewStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not parse structure.");
    }
  }

  const summary = useMemo(() => summarizeScene(scene), [scene]);

  return (
    <main className="relative h-dvh min-w-80 overflow-hidden bg-background text-foreground">
      <section className="scene-stage absolute inset-0" aria-label="Crystal structure preview">
        {scene ? (
          <LatticeScene scene={scene} />
        ) : (
          <div
            className="grid h-full w-full place-items-center bg-background text-sm text-muted-foreground"
            data-state={previewStatus}
          >
            {previewStatus === "loading" ? "Loading structure" : "No structure loaded"}
          </div>
        )}
      </section>

      <aside
        className="absolute left-5 top-5 w-[360px] max-w-[calc(100vw-2.5rem)] rounded-lg border bg-card/92 p-[18px] shadow-xl shadow-foreground/10 backdrop-blur-md"
        aria-label="Structure preview"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[0.72rem] font-bold uppercase text-muted-foreground">
              Pretty Lattice
            </p>
            <h1 className="text-xl font-semibold leading-tight">Structure Preview</h1>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "min-w-16 rounded-full px-2 py-1 font-mono",
              previewStatusClasses[previewStatus],
            )}
          >
            {previewStatusLabel(previewStatus)}
          </Badge>
        </div>

        <Separator className="my-4" />

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          tabIndex={-1}
          onChange={(event) => void handleFileChange(event)}
        />

        <Button className="w-full justify-center" onClick={() => fileInputRef.current?.click()}>
          <FolderOpen aria-hidden="true" />
          <span>Open Structure</span>
        </Button>

        <div className="mt-4 rounded-md border bg-secondary/50 p-3">
          <span className="block text-xs font-bold text-muted-foreground">File</span>
          <strong className="mt-1 block break-words font-mono text-sm font-semibold leading-snug">
            {selectedFileName ?? "No file selected"}
          </strong>
        </div>

        {errorMessage ? (
          <div
            className="mt-3 rounded-md border border-destructive/20 bg-destructive/10 p-3 font-mono text-sm leading-snug text-destructive"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        {scene ? (
          <div className="mt-4 grid grid-cols-[0.8fr_1.2fr] gap-4">
            <div className="min-h-14">
              <span className="block text-xs font-bold text-muted-foreground">Atoms</span>
              <strong className="mt-2 block font-mono text-3xl leading-none tabular-nums">
                {summary.atomCount}
              </strong>
            </div>
            <div className="min-h-14 border-l pl-4">
              <span className="block text-xs font-bold text-muted-foreground">Elements</span>
              <strong className="mt-2 block break-words font-mono text-base font-semibold leading-tight">
                {summary.elementSummary}
              </strong>
            </div>
          </div>
        ) : null}
      </aside>
    </main>
  );
}
