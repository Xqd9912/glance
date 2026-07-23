import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import type { PreviewSafeArea, ScalarLegendSpec } from "../../model";
import { scalarPaletteCss } from "../../model";
import { GLASS_SURFACE_CLASS } from "../surface";

export function ScalarLegend({
  bottomPx = 28,
  offsetX = 0,
  safeArea,
  spec,
}: {
  bottomPx?: number;
  offsetX?: number;
  safeArea: PreviewSafeArea;
  spec: ScalarLegendSpec;
}) {
  return (
    <aside
      aria-label="Scalar property legend"
      className={cn(
        "pointer-events-none absolute z-20 min-w-64 -translate-x-1/2 rounded-xl border px-3 py-2 shadow-lg shadow-foreground/10",
        GLASS_SURFACE_CLASS,
      )}
      style={containerStyle(safeArea, offsetX, bottomPx)}
    >
      <div className="mb-1 text-center text-[11px] font-medium">
        {spec.label}{spec.unit ? ` (${spec.unit})` : ""}
      </div>
      <div className="h-2.5 rounded-full border border-foreground/10" style={{ background: scalarPaletteCss(spec.palette) }} />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{formatValue(spec.domain.min)}</span>
        <span>{formatValue(spec.domain.max)}</span>
      </div>
    </aside>
  );
}

function containerStyle(
  safeArea: PreviewSafeArea,
  offsetX: number,
  bottomPx: number,
): CSSProperties {
  return {
    bottom: `${bottomPx}px`,
    left: `calc(50% + ${(safeArea.left - safeArea.right) / 2 + offsetX}px)`,
    maxWidth: `min(calc(100vw - ${safeArea.left + safeArea.right + 32}px), 420px)`,
  };
}

function formatValue(value: number): string {
  return Math.abs(value) >= 100 || (Math.abs(value) > 0 && Math.abs(value) < 0.01)
    ? value.toExponential(2)
    : value.toFixed(3);
}
