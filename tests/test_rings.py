from __future__ import annotations

import math

import numpy as np
from pymatgen.core import Lattice, Structure

from glance.analysis import pipeline as analysis_pipeline
from glance.analysis import rings as R


def _cutoff(symbols: list[str], distance: float) -> np.ndarray:
    return np.full((len(symbols), len(symbols)), distance)


def test_single_hexagon_is_one_six_ring() -> None:
    radius = 1.4
    coords = [
        [5.0 + radius * math.cos(math.pi / 3 * k), 5.0 + radius * math.sin(math.pi / 3 * k), 5.0]
        for k in range(6)
    ]
    structure = Structure(Lattice.cubic(20.0), ["C"] * 6, coords, coords_are_cartesian=True)

    counts = R.ring_size_counts(structure, ["C"], _cutoff(["C"], 1.6), min_size=3, max_size=8)

    # sizes 3..8 -> exactly one 6-ring.
    assert counts.tolist() == [0, 0, 0, 1, 0, 0]


def test_isolated_cube_ring_set() -> None:
    # A cube graph (Q3) has 6 square faces and, under the shortest-path
    # (isometric) ring definition, 4 chordless hexagons that are not
    # short-circuited by any smaller path.
    cube = [
        [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
        [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
    ]
    coords = [[x + 5 for x in point] for point in cube]
    structure = Structure(Lattice.cubic(20.0), ["Si"] * 8, coords, coords_are_cartesian=True)

    counts = R.ring_size_counts(structure, ["Si"], _cutoff(["Si"], 1.2), min_size=3, max_size=8)

    assert counts.tolist() == [0, 6, 0, 4, 0, 0]


def test_periodic_graphene_counts_hexagons() -> None:
    lattice = Lattice.from_parameters(2.46, 2.46, 20.0, 90, 90, 120)
    sheet = Structure(lattice, ["C", "C"], [[1 / 3, 2 / 3, 0.5], [2 / 3, 1 / 3, 0.5]])
    sheet.make_supercell([3, 3, 1])

    counts = R.ring_size_counts(sheet, ["C"], _cutoff(["C"], 1.6), min_size=3, max_size=8)

    # One hexagon per two carbons; periodic images must not add spurious rings.
    assert counts.tolist() == [0, 0, 0, len(sheet) // 2, 0, 0]


def test_periodic_ring_offset_rejects_wraparound() -> None:
    # A short 1-D chain whose bond wraps the cell: two atoms bonded to each
    # other across the boundary form no ring (the offsets never cancel).
    structure = Structure(
        Lattice.orthorhombic(2.6, 20.0, 20.0),
        ["Na", "Na"],
        [[0.0, 0.5, 0.5], [0.5, 0.5, 0.5]],
    )
    counts = R.ring_size_counts(structure, ["Na"], _cutoff(["Na"], 1.6), min_size=3, max_size=9)
    assert counts.sum() == 0


def test_compute_rings_reports_per_frame_and_average() -> None:
    radius = 1.4
    coords = [
        [5.0 + radius * math.cos(math.pi / 3 * k), 5.0 + radius * math.sin(math.pi / 3 * k), 5.0]
        for k in range(6)
    ]
    frame = Structure(Lattice.cubic(20.0), ["C"] * 6, coords, coords_are_cartesian=True)
    frames = [frame, frame, frame]

    result = analysis_pipeline.compute_rings(
        frames, ["C"], [0, 1, 2], _cutoff(["C"], 1.6), min_size=3, max_size=7
    )

    assert result["sizes"] == [3, 4, 5, 6, 7]
    assert result["frames"] == [0, 1, 2]
    assert result["perFrame"] == [[0, 0, 0, 1, 0]] * 3
    # Identical frames -> mean equals the single-frame counts, std is zero.
    assert result["mean"] == [0.0, 0.0, 0.0, 1.0, 0.0]
    assert result["std"] == [0.0, 0.0, 0.0, 0.0, 0.0]
