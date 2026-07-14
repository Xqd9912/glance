import { describe, expect, it } from "bun:test";

import { boxStats, quantile } from "../src/app/analysis/chartMath";

describe("quantile", () => {
  it("interpolates like NumPy's default (type 7)", () => {
    const sorted = [1, 2, 3, 4];
    expect(quantile(sorted, 0.5)).toBeCloseTo(2.5);
    expect(quantile(sorted, 0.25)).toBeCloseTo(1.75);
    expect(quantile(sorted, 0.75)).toBeCloseTo(3.25);
  });

  it("handles single-element and empty inputs", () => {
    expect(quantile([7], 0.5)).toBe(7);
    expect(Number.isNaN(quantile([], 0.5))).toBe(true);
  });
});

describe("boxStats", () => {
  it("summarizes a simple distribution", () => {
    const stats = boxStats([1, 2, 3, 4, 5]);
    expect(stats).not.toBeNull();
    expect(stats!.min).toBe(1);
    expect(stats!.max).toBe(5);
    expect(stats!.median).toBeCloseTo(3);
    expect(stats!.q1).toBeCloseTo(2);
    expect(stats!.q3).toBeCloseTo(4);
    expect(stats!.outliers).toEqual([]);
  });

  it("flags points beyond 1.5·IQR as outliers and clamps whiskers", () => {
    const stats = boxStats([10, 11, 12, 13, 14, 100]);
    expect(stats).not.toBeNull();
    expect(stats!.outliers).toContain(100);
    expect(stats!.whiskerHigh).toBeLessThan(100);
  });

  it("returns null when there is no finite data", () => {
    expect(boxStats([])).toBeNull();
    expect(boxStats([Number.NaN, Number.POSITIVE_INFINITY])).toBeNull();
  });
});
