import { describe, expect, it } from "bun:test";

import { isTrajectoryFileName } from "../src/api/trajectory";

describe("isTrajectoryFileName", () => {
  it("recognizes supported trajectory files", () => {
    expect(isTrajectoryFileName("XDATCAR")).toBe(true);
    expect(isTrajectoryFileName("run.XDATCAR")).toBe(true);
    expect(isTrajectoryFileName("GST.dump")).toBe(true);
    expect(isTrajectoryFileName("md.lammpstrj")).toBe(true);
    expect(isTrajectoryFileName("traj.xyz")).toBe(true);
  });

  it("treats single-structure files as non-trajectories", () => {
    expect(isTrajectoryFileName("POSCAR")).toBe(false);
    expect(isTrajectoryFileName("structure.cif")).toBe(false);
    expect(isTrajectoryFileName("CONTCAR")).toBe(false);
  });
});
