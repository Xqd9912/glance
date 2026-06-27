import { describe, expect, test } from "bun:test";

import { createPreviewFpsStore } from "../src/model/previewFpsStore";

describe("preview FPS store", () => {
  test("ignores unchanged idle snapshots", () => {
    const store = createPreviewFpsStore();
    let notificationCount = 0;
    store.subscribeFps(() => {
      notificationCount += 1;
    });

    store.setFpsSnapshot(0);
    store.setFpsSnapshot(Number.NaN);

    expect(store.getFpsSnapshot()).toBe(0);
    expect(notificationCount).toBe(0);
  });

  test("rounds and publishes changed snapshots", () => {
    const store = createPreviewFpsStore();
    const snapshots: number[] = [];
    store.subscribeFps(() => {
      snapshots.push(store.getFpsSnapshot());
    });

    store.setFpsSnapshot(58.6);
    store.setFpsSnapshot(58.4);
    store.setFpsSnapshot(-1);

    expect(snapshots).toEqual([59, 58, 0]);
  });
});
