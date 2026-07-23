import { useEffect, useState } from "react";
import { LineChart as LineChartIcon, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { TrajectoryMeta } from "../../api/trajectory";

const FPS_OPTIONS = [2, 5, 10, 20, 30];

export function TrajectoryPlayer({
  disabled = false,
  frameIndex,
  isPlaying,
  meta,
  onApplyTypeMap,
  onFpsChange,
  onFrameChange,
  onOpenAnalysis,
  onTogglePlay,
  playbackFps,
}: {
  disabled?: boolean;
  frameIndex: number;
  isPlaying: boolean;
  meta: TrajectoryMeta;
  onApplyTypeMap: (typeMap: Record<number, string>) => void;
  onFpsChange: (fps: number) => void;
  onFrameChange: (frameIndex: number) => void;
  onOpenAnalysis: () => void;
  onTogglePlay: () => void;
  playbackFps: number;
}) {
  const lastFrame = Math.max(0, meta.frameCount - 1);

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-6 z-20 flex justify-center px-4">
      <div className="flex w-full max-w-[720px] flex-col gap-2 rounded-xl border border-border bg-background/90 px-4 py-3 shadow-[0_18px_44px_rgb(34_39_46/0.12)] backdrop-blur">
        {meta.typeIds ? (
          <TypeMapEditor
            disabled={disabled}
            typeIds={meta.typeIds}
            elements={meta.elements}
            onApply={onApplyTypeMap}
          />
        ) : null}

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label={isPlaying ? "Pause trajectory" : "Play trajectory"}
            disabled={disabled}
            className="size-8 shrink-0"
            onClick={onTogglePlay}
          >
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </Button>

          <input
            type="range"
            aria-label="Trajectory frame"
            min={0}
            max={lastFrame}
            step={1}
            value={Math.min(frameIndex, lastFrame)}
            disabled={disabled}
            className="h-1.5 min-w-0 flex-1 cursor-pointer accent-foreground"
            onChange={(event) => onFrameChange(Number(event.currentTarget.value))}
          />

          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {frameIndex + 1} / {meta.frameCount}
          </span>

          <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <span className="sr-only">Playback speed</span>
            <select
              aria-label="Playback speed (frames per second)"
              value={playbackFps}
              disabled={disabled}
              className="h-7 rounded-md border border-border bg-background px-1 text-xs tabular-nums"
              onChange={(event) => onFpsChange(Number(event.currentTarget.value))}
            >
              {FPS_OPTIONS.map((fps) => (
                <option key={fps} value={fps}>
                  {fps} fps
                </option>
              ))}
            </select>
          </label>

          <Button
            variant="outline"
            size="sm"
            aria-label="Open structure analysis"
            className="h-7 shrink-0 gap-1 px-2 text-xs"
            onClick={onOpenAnalysis}
          >
            <LineChartIcon aria-hidden="true" className="size-3.5" />
            Analysis
          </Button>
        </div>
      </div>
    </div>
  );
}

function TypeMapEditor({
  disabled,
  elements,
  onApply,
  typeIds,
}: {
  disabled: boolean;
  elements: string[];
  onApply: (typeMap: Record<number, string>) => void;
  typeIds: number[];
}) {
  const [draft, setDraft] = useState<Record<number, string>>({});

  useEffect(() => {
    setDraft({});
  }, [typeIds]);

  function apply() {
    const typeMap: Record<number, string> = {};
    for (const typeId of typeIds) {
      const symbol = draft[typeId]?.trim();
      if (symbol) {
        typeMap[typeId] = symbol;
      }
    }
    if (Object.keys(typeMap).length > 0) {
      onApply(typeMap);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2 text-xs">
      <span className="text-muted-foreground">
        Map atom types to elements (current: {elements.join(", ")}):
      </span>
      {typeIds.map((typeId) => (
        <label key={typeId} className="flex items-center gap-1">
          <span className="text-muted-foreground">type {typeId}</span>
          <input
            type="text"
            aria-label={`Element for atom type ${typeId}`}
            value={draft[typeId] ?? ""}
            placeholder="e.g. Ge"
            disabled={disabled}
            className="h-6 w-14 rounded-md border border-border bg-background px-1 text-center font-mono"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setDraft((current) => ({ ...current, [typeId]: value }));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                apply();
              }
            }}
          />
        </label>
      ))}
      <Button variant="outline" size="sm" className="h-6 px-2" disabled={disabled} onClick={apply}>
        Apply
      </Button>
    </div>
  );
}
