import { describe, expect, test } from "bun:test";

import {
  createDefaultComponentOpacity,
  createDefaultComponentVisibility,
  createDefaultPeriodicCellRange,
  createDefaultStyle,
  createDisplayPreset,
  assertUniqueDisplayPresetNames,
  findDisplayPresetByName,
  loadDisplayPresets,
  overwriteDisplayPreset,
  parseDisplayPresets,
  renameDisplayPreset,
  saveDisplayPresets,
  serializeDisplayPresets,
  uniquifyDisplayPresetNames,
  type DisplayPresetSnapshot,
} from "../src/model";

describe("display presets", () => {
  test("round-trips schema version 1 without sharing nested state", () => {
    const snapshot = presetSnapshot();
    const preset = createDisplayPreset("Publication", snapshot);
    snapshot.style.atomRadius = 99;
    const parsed = parseDisplayPresets(serializeDisplayPresets([preset]));
    expect(parsed[0]?.name).toBe("Publication");
    expect(parsed[0]?.snapshot.style.atomRadius).toBe(40);
  });

  test("supports overwrite and rename while preserving identity", () => {
    const preset = createDisplayPreset("Initial", presetSnapshot());
    const changed = presetSnapshot();
    changed.previewMeshQuality = "xhigh";
    const overwritten = overwriteDisplayPreset(preset, changed);
    const renamed = renameDisplayPreset(overwritten, "  Final  ");
    expect(overwritten.id).toBe(preset.id);
    expect(overwritten.snapshot.previewMeshQuality).toBe("xhigh");
    expect(renamed.name).toBe("Final");
  });

  test("matches preset names case-insensitively and rejects duplicate bundles", () => {
    const first = createDisplayPreset("Publication", presetSnapshot());
    const second = createDisplayPreset("Analysis", presetSnapshot());
    expect(findDisplayPresetByName([first, second], " publication ")?.id).toBe(first.id);
    expect(findDisplayPresetByName([first, second], "Publication", first.id)).toBeNull();

    const duplicate = renameDisplayPreset(second, "PUBLICATION");
    expect(() => assertUniqueDisplayPresetNames([first, duplicate])).toThrow("must be unique");
    expect(uniquifyDisplayPresetNames([first, duplicate]).map((preset) => preset.name)).toEqual([
      "Publication",
      "PUBLICATION (2)",
    ]);
  });

  test("disambiguates legacy duplicate names loaded from local storage", () => {
    const first = createDisplayPreset("View", presetSnapshot());
    const duplicate = renameDisplayPreset(
      createDisplayPreset("Second", presetSnapshot()),
      "view",
    );
    const storage = {
      getItem: () => serializeDisplayPresets([first, duplicate]),
    };
    const loaded = loadDisplayPresets(storage);
    expect(loaded.presets.map((preset) => preset.name)).toEqual(["View", "view (2)"]);
    expect(loaded.error).toContain("renamed");
  });

  test("rejects damaged or unknown JSON without changing saved presets", () => {
    expect(() => parseDisplayPresets('{"schemaVersion":2,"presets":[]}')).toThrow(
      "Unsupported preset schema version",
    );
    expect(() => parseDisplayPresets('{"schemaVersion":1,"presets":[{}]}')).toThrow(
      "damaged",
    );

    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const preset = createDisplayPreset("Stored", presetSnapshot());
    saveDisplayPresets([preset], storage);
    expect(loadDisplayPresets(storage).presets[0]?.name).toBe("Stored");
    values.set("glance.display-presets.v1", "bad json");
    expect(loadDisplayPresets(storage)).toEqual({
      presets: [],
      error: "The preset file is not valid JSON.",
    });
  });
});

function presetSnapshot(): DisplayPresetSnapshot {
  return {
    componentOpacity: createDefaultComponentOpacity(),
    componentVisibility: createDefaultComponentVisibility(),
    periodicCellRange: createDefaultPeriodicCellRange(),
    cameraState: {
      direct: [0, 0, 1],
      primary: "upward",
      reciprocal: [1, 0, 0],
      secondary: "right",
      rollDegrees: 0,
    },
    viewScale: 1,
    style: createDefaultStyle(),
    lightStrength: 1,
    unitCellLineStyle: "solid",
    showCrystalAxisLabels: true,
    previewMeshQuality: "medium",
  };
}
