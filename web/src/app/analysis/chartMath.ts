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
