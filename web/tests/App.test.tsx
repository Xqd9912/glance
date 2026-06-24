import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ReactNode } from "react";
import { Quaternion, Vector3 } from "three";

import type { AtomSpec, SceneSpec } from "../src/api/scene";

interface FetchCall {
  input: RequestInfo | URL;
  init: RequestInit | undefined;
}

class MockControls {
  enabled = true;
  mouseButtons: Record<string, unknown> = {};
  noPan = false;
  noRotate = false;
  noZoom = false;
  target = new Vector3();
  touches: Record<string, unknown> = {};

  dispose() {}

  handleResize() {}

  update() {}
}

class MockOrbitControls extends MockControls {}

class MockTrackballControls extends MockControls {}

class MockCamera {
  far = 1000;
  near = 0.01;
  position = new Vector3();
  quaternion = new Quaternion();
  up = new Vector3(0, 1, 0);

  lookAt() {}

  updateProjectionMatrix() {}
}

mock.module("@react-three/fiber", () => {
  return {
    Canvas: ({
      camera: _camera,
      children: _children,
      gl: _gl,
      orthographic: _orthographic,
      ...props
    }: {
      camera?: unknown;
      children: ReactNode;
      gl?: unknown;
      orthographic?: boolean;
    }) => <div {...props} />,
    useFrame: () => {},
    useThree: () => ({
      camera: new MockCamera(),
      gl: {
        domElement: document.createElement("canvas"),
      },
      size: {
        height: 768,
        width: 1024,
      },
    }),
  };
});

mock.module("three/examples/jsm/controls/OrbitControls.js", () => ({
  OrbitControls: MockOrbitControls,
}));

mock.module("three/examples/jsm/controls/TrackballControls.js", () => ({
  TrackballControls: MockTrackballControls,
}));

mock.module("../src/scene/OrientationGizmo", () => ({
  OrientationGizmo: () => <div data-testid="mock-orientation-gizmo" />,
}));

const { App } = await import("../src/app/App");
let fetchCalls: FetchCall[] = [];
let fetchResponses: Response[] = [];

beforeEach(() => {
  fetchCalls = [];
  fetchResponses = [];
  globalThis.fetch = (async (input, init) => {
    fetchCalls.push({ input, init });
    const response = fetchResponses.shift();
    if (!response) {
      throw new Error("Unexpected fetch request.");
    }

    return response;
  }) as typeof fetch;
});

describe("App", () => {
  test("starts with an empty preview and a compact structure card", () => {
    render(<App />);

    expect(screen.getByText("No structure loaded").isConnected).toBe(true);
    expect(screen.queryByTestId("lattice-canvas")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open settings" })).toBeNull();

    const structureCard = screen.getByRole("complementary", { name: "Current structure" });
    expect(within(structureCard).getByText("Pretty Lattice").isConnected).toBe(true);
    expect(within(structureCard).getByText("No file selected").isConnected).toBe(true);
  });

  test("uploads a structure and renders the summary, legend, and view controls", async () => {
    const user = userEvent.setup();
    const scene = sceneWithPeriodicImages();
    const file = structureFile();
    queueFetchResponse(jsonResponse(scene));

    render(<App />);

    await user.upload(getFileInput(), file);

    await waitFor(() => expect(fetchCalls).toHaveLength(1));
    const uploadRequest = fetchCalls[0]!;
    expect(uploadRequest.input).toBe("/api/structure-preview");
    expect(uploadRequest.init?.body).toBe(file);
    expect(uploadRequest.init?.method).toBe("POST");
    expect(uploadRequest.init?.headers).toEqual({
      "content-type": "chemical/x-cif",
      "x-pretty-lattice-filename": "NaCl.cif",
    });

    expect((await screen.findByTestId("lattice-canvas")).isConnected).toBe(true);
    expect(screen.getByTestId("mock-orientation-gizmo").isConnected).toBe(true);

    const structureCard = screen.getByRole("complementary", { name: "Current structure" });
    expect(within(structureCard).getByText("NaCl.cif").isConnected).toBe(true);
    expect(within(structureCard).getByText("NaCl").isConnected).toBe(true);
    expect(within(structureCard).getByText("2").isConnected).toBe(true);
    expect(within(structureCard).getByText("Symmetry unavailable").isConnected).toBe(true);

    const legend = screen.getByRole("navigation", { name: "Element legend" });
    expect(within(legend).getByText("Na").isConnected).toBe(true);
    expect(within(legend).getByText("Cl").isConnected).toBe(true);
    expect(screen.getByRole("complementary", { name: "View controls" }).isConnected).toBe(true);
  });

  test("lets settings change boundary atom visibility and rotation mode", async () => {
    const user = userEvent.setup();

    await renderLoadedStructure(user);
    await user.click(screen.getByRole("button", { name: "Open settings" }));

    const boundaryAtomSwitch = screen.getByRole("switch", {
      name: "Show boundary atom images",
    });
    expect((boundaryAtomSwitch as HTMLButtonElement).disabled).toBe(false);
    expect(boundaryAtomSwitch.getAttribute("aria-checked")).toBe("true");

    await user.click(boundaryAtomSwitch);

    expect(boundaryAtomSwitch.getAttribute("aria-checked")).toBe("false");

    expect(screen.getByRole("radio", { name: "Trackball" }).getAttribute("aria-checked")).toBe(
      "true",
    );

    await user.click(screen.getByRole("radio", { name: "Orbit" }));

    expect(screen.getByRole("radio", { name: "Orbit" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  test("keeps view controls wired to lock, zoom, and reset state", async () => {
    const user = userEvent.setup();

    await renderLoadedStructure(user);

    await user.click(screen.getByRole("button", { name: "Lock canvas interaction" }));

    expect(
      screen.getByRole("button", { name: "Unlock canvas interaction" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");

    const zoomInput = screen.getByRole("textbox", { name: "Zoom percentage input" });
    await user.clear(zoomInput);
    await user.type(zoomInput, "250{Enter}");

    expect((zoomInput as HTMLInputElement).value).toBe("250");

    await user.click(screen.getByRole("button", { name: "Reset view" }));

    expect((zoomInput as HTMLInputElement).value).toBe("100");
  });

  test("shows API parse errors without leaving a stale scene behind", async () => {
    const user = userEvent.setup();
    queueFetchResponse(errorResponse("Could not parse CIF."));

    render(<App />);

    await user.upload(getFileInput(), structureFile("bad.cif"));

    expect((await screen.findByRole("alert")).textContent).toContain("Could not parse CIF.");
    expect(screen.getByText("No structure loaded").isConnected).toBe(true);
    expect(screen.queryByTestId("lattice-canvas")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open settings" })).toBeNull();
  });
});

async function renderLoadedStructure(user: UserEvent) {
  queueFetchResponse(jsonResponse(sceneWithPeriodicImages()));

  render(<App />);
  await user.upload(getFileInput(), structureFile());
  await screen.findByTestId("lattice-canvas");
}

function queueFetchResponse(response: Response) {
  fetchResponses.push(response);
}

function getFileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Could not find structure file input.");
  }

  return input;
}

function jsonResponse(body: unknown): Response {
  return {
    json: async () => body,
    ok: true,
  } as Response;
}

function errorResponse(message: string): Response {
  return {
    json: async () => ({ detail: { message } }),
    ok: false,
    status: 422,
  } as Response;
}

function structureFile(name = "NaCl.cif"): File {
  return new File(["data_NaCl"], name, { type: "chemical/x-cif" });
}

function sceneWithPeriodicImages(): SceneSpec {
  return {
    atoms: [
      atom("Na-0", "Na", false),
      atom("Na-0-image-1-0-0", "Na", true),
      atom("Cl-1", "Cl", false),
      atom("Cl-1-image-1-0-0", "Cl", true),
    ],
    cell: {
      vectors: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
    },
    summary: {
      atomCount: 2,
      cell: {
        a: "1.00",
        alpha: "90.00",
        b: "1.00",
        beta: "90.00",
        c: "1.00",
        gamma: "90.00",
      },
      formula: "NaCl",
      symmetry: {
        available: false,
        crystalSystem: null,
        latticeSystem: null,
        pointGroup: null,
        pointGroupSchoenflies: null,
        spaceGroup: null,
        spaceGroupNumber: null,
      },
    },
  };
}

function atom(id: string, element: string, isPeriodicImage: boolean): AtomSpec {
  const vector: [number, number, number] = isPeriodicImage ? [1, 0, 0] : [0, 0, 0];

  return {
    color: element === "Na" ? "#fadd3d" : "#1ff01f",
    element,
    fractionalPosition: vector,
    id,
    imageOffset: vector,
    isPeriodicImage,
    position: vector,
    radius: 0.5,
    siteId: id.replace("-image-1-0-0", ""),
  };
}
