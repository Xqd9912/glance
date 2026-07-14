export const CHART_MARGIN = { top: 8, right: 12, bottom: 34, left: 44 };
export const CHART_WIDTH = 360;

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min];
  }
  const span = max - min;
  const step0 = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(step0));
  const residual = step0 / magnitude;
  const step = (residual >= 5 ? 5 : residual >= 2 ? 2 : 1) * magnitude;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + step * 1e-6; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return ticks;
}

export interface BoxStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  /** Whisker ends (furthest points within 1.5·IQR of the quartiles). */
  whiskerLow: number;
  whiskerHigh: number;
  /** Points beyond the whiskers. */
  outliers: number[];
}

/** Linear-interpolation quantile (matches NumPy's default `type 7`). */
export function quantile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) {
    return NaN;
  }
  if (n === 1) {
    return sorted[0]!;
  }
  const position = (n - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, n - 1);
  const fraction = position - lower;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * fraction;
}

/** Tukey box-plot summary for one distribution. */
export function boxStats(values: number[]): BoxStats | null {
  const finite = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (finite.length === 0) {
    return null;
  }
  const q1 = quantile(finite, 0.25);
  const median = quantile(finite, 0.5);
  const q3 = quantile(finite, 0.75);
  const iqr = q3 - q1;
  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;
  const inRange = finite.filter((value) => value >= lowFence && value <= highFence);
  const whiskerLow = inRange.length > 0 ? inRange[0]! : finite[0]!;
  const whiskerHigh = inRange.length > 0 ? inRange[inRange.length - 1]! : finite[finite.length - 1]!;
  const outliers = finite.filter((value) => value < whiskerLow || value > whiskerHigh);
  return {
    min: finite[0]!,
    q1,
    median,
    q3,
    max: finite[finite.length - 1]!,
    whiskerLow,
    whiskerHigh,
    outliers,
  };
}

export function minMax(series: number[][]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const values of series) {
    for (const value of values) {
      if (Number.isFinite(value)) {
        if (value < lo) lo = value;
        if (value > hi) hi = value;
      }
    }
  }
  return [lo, hi];
}
