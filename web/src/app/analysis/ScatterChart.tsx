import { useId, useMemo } from "react";

import { CHART_MARGIN as MARGIN, CHART_WIDTH, minMax, niceTicks } from "./chartMath";

export interface ScatterPoint {
  x: number;
  y: number;
}

export interface ScatterSeries {
  label: string;
  points: ScatterPoint[];
  color: string;
  /** Marker radius in SVG units. */
  size: number;
}

interface ScatterChartProps {
  series: ScatterSeries[];
  xDomain?: [number, number];
  yDomain?: [number, number];
  xLabel?: string;
  yLabel?: string;
  height?: number;
}

/**
 * Scatter plot for LOBSTER bonding data (value vs. bond length). Multiple series
 * (e.g. one per element pair) are overlaid with per-series color and marker
 * size, mirroring the axis/tick styling of {@link LineChart} for consistency.
 */
export function ScatterChart({
  series,
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  height = 240,
}: ScatterChartProps) {
  const clipId = useId();
  const width = CHART_WIDTH;
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;

  const domains = useMemo(() => {
    const xs = series.map((s) => s.points.map((p) => p.x));
    const ys = series.map((s) => s.points.map((p) => p.y));
    const [xLo, xHi] = minMax(xs);
    const [yLo, yHi] = minMax(ys);
    const safeXLo = Number.isFinite(xLo) ? xLo : 0;
    const safeXHi = Number.isFinite(xHi) ? xHi : 1;
    const safeYLo = Number.isFinite(yLo) ? yLo : 0;
    const safeYHi = Number.isFinite(yHi) ? yHi : 1;
    const padX = (safeXHi - safeXLo) * 0.04 || 0.1;
    const padY = (safeYHi - safeYLo) * 0.06 || 0.1;
    const dx: [number, number] = xDomain ?? [safeXLo - padX, safeXHi + padX];
    const dy: [number, number] = yDomain ?? [safeYLo - padY, safeYHi + padY];
    return { dx, dy };
  }, [series, xDomain, yDomain]);

  const { dx, dy } = domains;
  const spanX = dx[1] - dx[0] || 1;
  const spanY = dy[1] - dy[0] || 1;
  const scaleX = (value: number) => MARGIN.left + ((value - dx[0]) / spanX) * plotWidth;
  const scaleY = (value: number) =>
    MARGIN.top + plotHeight - ((value - dy[0]) / spanY) * plotHeight;

  const xTicks = niceTicks(dx[0], dx[1]);
  const yTicks = niceTicks(dy[0], dy[1]);
  const zeroInRange = dy[0] < 0 && dy[1] > 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="plot-chart w-full"
      role="img"
      aria-label={`${yLabel ?? "value"} vs ${xLabel ?? "x"}`}
    >
      <clipPath id={clipId}>
        <rect x={MARGIN.left} y={MARGIN.top} width={plotWidth} height={plotHeight} />
      </clipPath>

      {yTicks.map((tick) => (
        <g key={`y${tick}`}>
          <line
            x1={MARGIN.left}
            x2={MARGIN.left + plotWidth}
            y1={scaleY(tick)}
            y2={scaleY(tick)}
            stroke="currentColor"
            strokeOpacity={0.08}
          />
          <text
            x={MARGIN.left - 6}
            y={scaleY(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[9px]"
          >
            {tick}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <text
          key={`x${tick}`}
          x={scaleX(tick)}
          y={height - MARGIN.bottom + 14}
          textAnchor="middle"
          className="fill-muted-foreground text-[9px]"
        >
          {tick}
        </text>
      ))}

      {/* Emphasize the y = 0 line: bonding vs. antibonding sits either side. */}
      {zeroInRange ? (
        <line
          x1={MARGIN.left}
          x2={MARGIN.left + plotWidth}
          y1={scaleY(0)}
          y2={scaleY(0)}
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeDasharray="3 3"
        />
      ) : null}

      <line
        x1={MARGIN.left}
        x2={MARGIN.left + plotWidth}
        y1={MARGIN.top + plotHeight}
        y2={MARGIN.top + plotHeight}
        stroke="currentColor"
        strokeOpacity={0.25}
      />
      <line
        x1={MARGIN.left}
        x2={MARGIN.left}
        y1={MARGIN.top}
        y2={MARGIN.top + plotHeight}
        stroke="currentColor"
        strokeOpacity={0.25}
      />

      <g clipPath={`url(#${clipId})`}>
        {series.map((s) => (
          <g key={s.label} fill={s.color} fillOpacity={0.7}>
            {s.points.map((point, index) => (
              <circle
                key={index}
                cx={scaleX(point.x)}
                cy={scaleY(point.y)}
                r={s.size}
              />
            ))}
          </g>
        ))}
      </g>

      {xLabel ? (
        <text
          x={MARGIN.left + plotWidth / 2}
          y={height - 2}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          {xLabel}
        </text>
      ) : null}
      {yLabel ? (
        <text
          x={10}
          y={MARGIN.top + plotHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 10 ${MARGIN.top + plotHeight / 2})`}
          className="fill-muted-foreground text-[10px]"
        >
          {yLabel}
        </text>
      ) : null}
    </svg>
  );
}
