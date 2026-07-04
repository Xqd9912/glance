import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ELECTRONIC_PANEL_MIN_WIDTH_PX } from "../../model/layout";
import type { SceneSpec } from "../../api/scene";
import type { IsosurfaceOverlay } from "../../scene/DensityIsosurface";

import {
  uploadDos,
  uploadIpr,
  type DosResponse,
  type IprResponse,
} from "../../api/electronic";
import { LineChartCard } from "../analysis/chartCards";
import { DosIprCard } from "./DosIprCard";
import { LobsterSection } from "./LobsterSection";
import { VolumetricSection } from "./VolumetricSection";

type Status = "idle" | "loading" | "ready" | "error";

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

function UploadButton({
  accept,
  disabled,
  label,
  onFile,
}: {
  accept?: string;
  disabled?: boolean;
  label: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            onFile(file);
          }
        }}
      />
      <Button
        size="sm"
        variant="outline"
        className="w-fit"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud aria-hidden="true" />
        {label}
      </Button>
    </>
  );
}

export function ElectronicPanel({
  isOpen,
  width,
  onWidthChange,
  rightOffset,
  onResizeActiveChange,
  onDensitySceneChange,
  onIsosurfaceChange,
}: {
  isOpen: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  rightOffset: number;
  onResizeActiveChange: (active: boolean) => void;
  onDensitySceneChange: (next: { scene: SceneSpec; fileName: string } | null) => void;
  onIsosurfaceChange: (overlay: IsosurfaceOverlay | null) => void;
}) {
  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      onResizeActiveChange(true);
      const panelRightEdge = window.innerWidth - rightOffset;
      const onMove = (moveEvent: PointerEvent) => {
        const next = panelRightEdge - moveEvent.clientX;
        const clamped = Math.max(
          ELECTRONIC_PANEL_MIN_WIDTH_PX,
          Math.min(next, window.innerWidth - 220),
        );
        onWidthChange(clamped);
      };
      const onUp = () => {
        onResizeActiveChange(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [onResizeActiveChange, onWidthChange, rightOffset],
  );

  // DOS + IPR.
  const [dosStatus, setDosStatus] = useState<Status>("idle");
  const [dos, setDos] = useState<DosResponse | null>(null);
  const [iprStatus, setIprStatus] = useState<Status>("idle");
  const [ipr, setIpr] = useState<IprResponse | null>(null);

  const [error, setError] = useState<string | null>(null);

  const loadDos = useCallback(async (file: File) => {
    setDosStatus("loading");
    setError(null);
    try {
      setDos(await uploadDos(file));
      setDosStatus("ready");
    } catch (caught) {
      setDosStatus("error");
      setError(errorMessage(caught, "DOS load failed."));
    }
  }, []);

  const loadIpr = useCallback(async (file: File) => {
    setIprStatus("loading");
    setError(null);
    try {
      setIpr(await uploadIpr(file));
      setIprStatus("ready");
    } catch (caught) {
      setIprStatus("error");
      setError(errorMessage(caught, "IPR load failed."));
    }
  }, []);

  return (
    <aside
      aria-label="Electronic properties"
      aria-hidden={!isOpen}
      inert={!isOpen}
      style={{
        width,
        right: rightOffset,
        // When closed, translate fully off-screen accounting for the right
        // offset — otherwise a nonzero offset leaves the panel partly visible,
        // covering the inspector column.
        transform: isOpen ? "translateX(0)" : `translateX(calc(100% + ${rightOffset}px))`,
      }}
      className={cn(
        "absolute inset-y-0 z-30 flex max-w-[calc(100vw-1rem)] flex-col border-l border-border bg-[#fdfdfd] text-foreground",
        "transition-transform duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
      )}
    >
      <div
        aria-hidden="true"
        onPointerDown={handleResizeStart}
        className="absolute inset-y-0 left-0 z-40 w-1.5 cursor-col-resize hover:bg-foreground/10"
        title="Drag to resize"
      />
      <header className="flex h-14 shrink-0 items-center px-4 pr-16">
        <h2 className="text-sm font-semibold">Electronic properties</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex flex-col gap-5">
          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          {/* Charge density (CHGCAR): slice, isosurface, LED distribution, profile. */}
          <VolumetricSection
            kind="chgcar"
            title="CHGCAR"
            onDensitySceneChange={onDensitySceneChange}
            onIsosurfaceChange={onIsosurfaceChange}
            onError={setError}
          />

          {/* Electron localization (ELFCAR): reuses the same volumetric pipeline. */}
          <VolumetricSection
            kind="elfcar"
            title="ELFCAR"
            onDensitySceneChange={onDensitySceneChange}
            onIsosurfaceChange={onIsosurfaceChange}
            onError={setError}
          />

          {/* LOBSTER: BWDF + ICOHP/ICOOP per-bond scatter plots. */}
          <LobsterSection onError={setError} />

          {/* DOS. */}
          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-bold text-muted-foreground">Density of states (TDOS.dat)</h3>
            <UploadButton
              label={dosStatus === "loading" ? "Loading DOS…" : "Load TDOS.dat"}
              disabled={dosStatus === "loading"}
              onFile={(file) => void loadDos(file)}
            />
          </section>

          {dos ? (
            <LineChartCard
              title="Total density of states"
              xLabel="energy (eV)"
              yLabel="DOS"
              series={dos.channels.map((channel) => ({
                label: channel.label,
                x: dos.energy,
                y: channel.values,
              }))}
            />
          ) : null}

          {/* IPR + DOS overlay. */}
          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-bold text-muted-foreground">IPR (vasprun.xml)</h3>
            <UploadButton
              label={iprStatus === "loading" ? "Computing IPR…" : "Load vasprun.xml"}
              disabled={iprStatus === "loading"}
              onFile={(file) => void loadIpr(file)}
            />
          </section>

          {ipr ? (
            <DosIprCard
              dosEnergy={ipr.dos.energy}
              dosTotal={ipr.dos.total}
              iprEnergy={ipr.ipr.energy}
              iprValue={ipr.ipr.value}
              efermi={ipr.efermi}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
}
