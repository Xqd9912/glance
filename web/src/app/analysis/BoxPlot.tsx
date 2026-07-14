import { CHART_MARGIN as MARGIN, CHART_WIDTH, boxStats, niceTicks } from "./chartMath";

interface BoxPlotProps {
  /** Category value for each box (e.g. ring size). */
  categories: number[];
  /** One value array per category — the distribution drawn as a box. */
  data: number[][];
  /** Shared color for every box. */
  color: string;
  xDomain?: [number, number];
  yDomain?: [number, number];
  xLabel?: string;
  yLabel?: string;
  height?: number;
}

const FALLBACK_COLOR = "#111827";

/**
 * Tukey box plot with one box per category. Each box shows the interquartile
 * range (Q1–Q3) with a median line, whiskers to the furthest points within
 * 1.5·IQR, and outliers as dots. Categories share the y-scale, so boxes are
 * directly comparable (e.g. the per-frame spread of each ring size). Each box
 * carries its own color so individual categories can be recolored.
 */
export function BoxPlot({
  categories,
  data,
  color,
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  height = 240,
}: BoxPlotProps) {
  const width = CHART_WIDTH;
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;

  const [xLo, xHi] = xDomain ?? [-Infinity, Infinity];
  const boxColor = color || FALLBACK_COLOR;
  const shown = categories
    .map((category, index) => ({ category, stats: boxStats(data[index] ?? []) }))
    .filter(({ category, stats }) => stats !== null && category >= xLo && category <= xHi);

  let dataMax = 0;
  for (const { stats } of shown) {
    if (stats) {
      dataMax = Math.max(dataMax, stats.max);
    }
  }
  const dy: [number, number] = yDomain ?? [0, dataMax * 1.08 || 1];
  const spanY = dy[1] - dy[0] || 1;
  const scaleY = (value: number) => MARGIN.top + plotHeight - ((value - dy[0]) / spanY) * plotHeight;

  const yTicks = niceTicks(dy[0], dy[1]);
  const count = shown.length;
  const slot = count > 0 ? plotWidth / count : plotWidth;
  // Narrow boxes: capped tighter and using a smaller fraction of the slot.
  const boxWidth = Math.max(4, Math.min(16, slot * 0.38));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="plot-chart w-full"
      role="img"
      aria-label={`${yLabel ?? "value"} distribution by ${xLabel ?? "category"}`}
    >
      {yTicks.map((tick) => (
        <g key={`y${tick}`}>
          <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={scaleY(tick)} y2={scaleY(tick)} stroke="currentColor" strokeOpacity={0.08} />
          <text x={MARGIN.left - 6} y={scaleY(tick)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[9px]">
            {tick}
          </text>
        </g>
      ))}

      <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={MARGIN.top + plotHeight} y2={MARGIN.top + plotHeight} stroke="currentColor" strokeOpacity={0.25} />
      <line x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke="currentColor" strokeOpacity={0.25} />

      {shown.map(({ category, stats }, position) => {
        if (!stats) {
          return null;
        }
        const center = MARGIN.left + slot * (position + 0.5);
        const left = center - boxWidth / 2;
        const capWidth = boxWidth * 0.6;
        const boxTop = scaleY(stats.q3);
        const boxHeight = Math.max(1, scaleY(stats.q1) - scaleY(stats.q3));
        return (
          <g key={`c${category}-${position}`}>
            {/* Whiskers */}
            <line x1={center} x2={center} y1={scaleY(stats.whiskerHigh)} y2={scaleY(stats.q3)} stroke={boxColor} strokeOpacity={0.7} />
            <line x1={center} x2={center} y1={scaleY(stats.q1)} y2={scaleY(stats.whiskerLow)} stroke={boxColor} strokeOpacity={0.7} />
            <line x1={center - capWidth / 2} x2={center + capWidth / 2} y1={scaleY(stats.whiskerHigh)} y2={scaleY(stats.whiskerHigh)} stroke={boxColor} strokeOpacity={0.7} />
            <line x1={center - capWidth / 2} x2={center + capWidth / 2} y1={scaleY(stats.whiskerLow)} y2={scaleY(stats.whiskerLow)} stroke={boxColor} strokeOpacity={0.7} />
            {/* IQR box */}
            <rect x={left} y={boxTop} width={boxWidth} height={boxHeight} fill={boxColor} fillOpacity={0.18} stroke={boxColor} strokeWidth={1.2} />
            {/* Median */}
            <line x1={left} x2={left + boxWidth} y1={scaleY(stats.median)} y2={scaleY(stats.median)} stroke={boxColor} strokeWidth={1.6} />
            {/* Outliers */}
            {stats.outliers.map((value, outlierIndex) => (
              <circle key={outlierIndex} cx={center} cy={scaleY(value)} r={1.6} fill={boxColor} fillOpacity={0.6} />
            ))}
            <text x={center} y={height - MARGIN.bottom + 14} textAnchor="middle" className="fill-muted-foreground text-[9px]">
              {category}
            </text>
          </g>
        );
      })}

      {xLabel ? (
        <text x={MARGIN.left + plotWidth / 2} y={height - 2} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {xLabel}
        </text>
      ) : null}
      {yLabel ? (
        <text x={10} y={MARGIN.top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90 10 ${MARGIN.top + plotHeight / 2})`} className="fill-muted-foreground text-[10px]">
          {yLabel}
        </text>
      ) : null}
    </svg>
  );
}
