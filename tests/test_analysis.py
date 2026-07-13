from __future__ import annotations

import numpy as np
import pytest
from pymatgen.core import Lattice, Structure

from glance.analysis import kernels as K


def test_grouped_frame_arrays_reorders_interleaved_elements() -> None:
    structure = Structure(
        Lattice.cubic(10.0),
        ["Te", "Ge", "Te", "Sb"],
        [[0.0, 0, 0], [0.1, 0, 0], [0.2, 0, 0], [0.3, 0, 0]],
    )

    frame = K.grouped_frame_arrays(structure, ["Ge", "Sb", "Te"])

    assert frame.element_counts == [1, 1, 2]
    assert frame.count_list == [0, 1, 2, 4]
    assert frame.element_index.tolist() == [0, 1, 2, 2]
    # Ge (was index 1) is now first, at fractional x = 0.1.
    assert frame.frac_coords[0][0] == pytest.approx(0.1)


def test_distance_matrix_uses_minimum_image() -> None:
    structure = Structure(Lattice.cubic(10.0), ["Cu", "Cu"], [[0.05, 0, 0], [0.95, 0, 0]])
    frame = K.grouped_frame_arrays(structure, ["Cu"])

    r = K.distance_matrix(frame.frac_coords, frame.cell)

    # Direct separation is 9.0 A; the minimum image is 1.0 A across the boundary.
    assert r[0, 1] == pytest.approx(1.0)


def test_coordination_counts_simple_cubic_neighbors() -> None:
    structure = Structure(Lattice.cubic(1.0), ["Cu"], [[0.0, 0, 0]])
    structure.make_supercell([3, 3, 3])  # 27 atoms, nearest-neighbour distance 1.0
    frame = K.grouped_frame_arrays(structure, ["Cu"])
    r = K.distance_matrix(frame.frac_coords, frame.cell)

    _, cn_per_atom, _ = K.coordination(r, np.array([[1.2]]), frame.element_counts, max_cn=20)

    # Every atom in simple cubic has 6 nearest neighbours within 1.2 A.
    assert set(cn_per_atom.tolist()) == {6}


def test_angular_distribution_resolves_a_right_angle() -> None:
    structure = Structure(
        Lattice.cubic(20.0),
        ["Cu"] * 6,
        # A central atom with two neighbours at 90 deg, plus three far atoms so
        # the order-parameter's 5-nearest lookup is well defined.
        [[0, 0, 0], [2, 0, 0], [0, 2, 0], [8, 0, 0], [0, 8, 0], [0, 0, 8]],
        coords_are_cartesian=True,
    )
    frame = K.grouped_frame_arrays(structure, ["Cu"])
    r = K.distance_matrix(frame.frac_coords, frame.cell)
    _, cn_per_atom, _ = K.coordination(r, np.array([[2.5]]), frame.element_counts, max_cn=20)
    nearest_index, _ = K.order_parameter(r, frame.count_list, int(cn_per_atom.max()))

    _, adf = K.angular_distribution(len(structure), cn_per_atom, nearest_index, r, frame.count_list)

    # Exactly one angle (at the central atom), landing in the 90-degree bin.
    assert adf[:-1, 1].sum() == 1
    assert adf[90, 1] == 1


def test_order_q_is_one_for_a_perfect_tetrahedron() -> None:
    directions = np.array(
        [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], dtype=float
    )
    directions /= np.linalg.norm(directions, axis=1, keepdims=True)
    positions = [[0.0, 0.0, 0.0], *(2.0 * directions).tolist()]
    structure = Structure(
        Lattice.cubic(30.0), ["Cu"] * 5, positions, coords_are_cartesian=True
    )
    frame = K.grouped_frame_arrays(structure, ["Cu"])
    r = K.distance_matrix(frame.frac_coords, frame.cell)
    _, cn_per_atom, _ = K.coordination(r, np.array([[2.5]]), frame.element_counts, max_cn=20)
    nearest_index, _ = K.order_parameter(r, frame.count_list, int(cn_per_atom.max()))
    cos_atom, _ = K.angular_distribution(
        len(structure), cn_per_atom, nearest_index, r, frame.count_list
    )

    _, q4, _ = K.order_q(cn_per_atom, cos_atom, frame.element_index)

    # The central atom is 4-fold; a perfect tetrahedron has q4 = 1.
    assert q4.shape[1] == 1
    assert q4[0, 0] == pytest.approx(1.0, abs=1e-9)


def test_pair_distribution_shape_and_normalization() -> None:
    structure = Structure(Lattice.cubic(1.0), ["Cu"], [[0.0, 0, 0]])
    structure.make_supercell([4, 4, 4])
    frame = K.grouped_frame_arrays(structure, ["Cu"])
    r = K.distance_matrix(frame.frac_coords, frame.cell)

    gr = K.pair_distribution(r, frame.element_counts, bin_width=0.1, r_max=10.0)

    # 100 bins + the leading zero row, columns: edge, total, and one Cu-Cu pair.
    assert gr.shape == (101, 3)
    assert np.all(gr[:, 1] >= 0)
    # Nearest-neighbour shell at 1.0 A is populated.
    assert gr[10, 1] > 0
