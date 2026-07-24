import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "bun:test";

import { DisplayPresetsPopover } from "../src/app/controls/commonPanel/DisplayPresetsPopover";
import {
  createDefaultComponentOpacity,
  createDefaultComponentVisibility,
  createDefaultPeriodicCellRange,
  createDefaultStyle,
  type DisplayPresetSnapshot,
} from "../src/model";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("DisplayPresetsPopover", () => {
  test("turns Save into explicit Overwrite for an existing case-insensitive name", async () => {
    const user = userEvent.setup();
    render(
      <DisplayPresetsPopover
        getSnapshot={presetSnapshot}
        onApply={() => null}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Presets/ }));
    const input = screen.getByRole("textbox", { name: "Preset name" });
    await user.type(input, "Publication");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getAllByText("Publication")).toHaveLength(1);

    await user.type(input, " publication ");
    const overwriteButtons = screen.getAllByRole("button", { name: "Overwrite" });
    expect(overwriteButtons).toHaveLength(2);
    await user.click(overwriteButtons[0]!);

    const presetList = screen.getByText("Publication").parentElement;
    expect(presetList).toBeTruthy();
    expect(within(presetList!).getByRole("button", { name: "Overwrite" })).toBeTruthy();
    expect(screen.getAllByText("Publication")).toHaveLength(1);
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
