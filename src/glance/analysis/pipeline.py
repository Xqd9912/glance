"""Multi-frame structure-analysis pipeline over a trajectory.

Orchestrates the per-frame kernels (:mod:`glance.analysis.kernels`) into
the frame-averaged descriptors the reference notebook produces — g(r), CN, ADF,
the local order parameter and the q order parameters — plus the fastatomstruct
dynamics (MSD over time and the ALTBC map).
"""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np
from pymatgen.core import Structure
from scipy.signal import find_peaks

from glance.analysis import kernels as K

BIN_WIDTH = 0.1
R_MAX = 10.0
MAX_CN = 20
MAX_ANGLE_FEA = 200


def element_pair_labels(symbols: Sequence[str]) -> list[str]:
    labels = []
    for i in range(len(symbols)):
        for j in range(i, len(symbols)):
            labels.append(f"{symbols[i]}-{symbols[j]}")
    return labels


def compute_gr(
    frames: Sequence[Structure],
    symbols: Sequence[str],
    indices: Sequence[int],
    *,
    bin_width: float = BIN_WIDTH,
    r_max: float = R_MAX,
) -> dict[str, object]:
    """Frame-averaged, normalized radial pair distribution."""
    symbols = list(symbols)
    accum = None
    for index in indices:
        frame = K.grouped_frame_arrays(frames[index], symbols)
        r = K.distance_matrix(frame.frac_coords, frame.cell)
        gr = K.pair_distribution(r, frame.element_counts, bin_width, r_max)
        accum = gr if accum is None else accum + gr
    n = max(1, len(indices))
    gr_output = accum / n
    # Normalize every curve by the tail of the total distribution (notebook).
    normalizer = gr_output[-1, 1] or 1.0
    gr_output[:, 1:] = gr_output[:, 1:] / normalizer

    pair_labels = element_pair_labels(symbols)
    return {
        "r": gr_output[:, 0].tolist(),
        "total": gr_output[:, 1].tolist(),
        "pairs": [
            {"label": label, "values": gr_output[:, 2 + i].tolist()}
            for i, label in enumerate(pair_labels)
        ],
    }


def suggest_cutoffs(gr: dict[str, object], symbols: Sequence[str]) -> list[dict[str, object]]:
    """First minimum of each pair g(r) → suggested per-pair cutoff distance."""
    symbols = list(symbols)
    r = np.array(gr["r"])
    suggestions: list[dict[str, object]] = []
    pairs = gr["pairs"]  # type: ignore[assignment]
    index = 0
    for i in range(len(symbols)):
        for j in range(i, len(symbols)):
            values = np.array(pairs[index]["values"])  # type: ignore[index]
            minima, _ = find_peaks(-values)
            distance = float(r[minima[0]]) if len(minima) else 0.0
            suggestions.append(
                {"elements": [symbols[i], symbols[j]], "distance": round(distance, 2)}
            )
            index += 1
    return suggestions


def cutoff_matrix_from_pairs(
    cutoffs: Sequence[dict[str, object]],
    symbols: Sequence[str],
) -> np.ndarray:
    symbols = list(symbols)
    order = {symbol: i for i, symbol in enumerate(symbols)}
    matrix = np.zeros((len(symbols), len(symbols)))
    for cutoff in cutoffs:
        a, b = cutoff["elements"]  # type: ignore[index]
        distance = float(cutoff["distance"])  # type: ignore[index]
        i, j = order[a], order[b]
        matrix[i, j] = distance
        matrix[j, i] = distance
    return matrix


def compute_descriptors(
    frames: Sequence[Structure],
    symbols: Sequence[str],
    indices: Sequence[int],
    cutoff_matrix: np.ndarray,
    *,
    max_cn: int = MAX_CN,
    max_angle_fea: int = MAX_ANGLE_FEA,
) -> dict[str, object]:
    """Frame-averaged CN, ADF, local order parameter and q order parameters."""
    symbols = list(symbols)
    cn_accum = adf_accum = od_accum = None
    q_raw: dict[int, np.ndarray] = {3: None, 4: None, 5: None}  # type: ignore[dict-item]
    bond_counts = np.zeros((len(symbols), len(symbols)))
    n = 0

    for index in indices:
        frame = K.grouped_frame_arrays(frames[index], symbols)
        r = K.distance_matrix(frame.frac_coords, frame.cell)
        cn, cn_p, bond = K.coordination(r, cutoff_matrix, frame.element_counts, max_cn)
        k_neighbors = int(cn_p.max()) if len(cn_p) else 1
        nearest_index, od = K.order_parameter(r, frame.count_list, k_neighbors)
        cos_atom, adf = K.angular_distribution(
            len(frame.element_index), cn_p, nearest_index, r, frame.count_list, max_angle_fea
        )
        q3, q4, q5 = K.order_q(cn_p, cos_atom, frame.element_index)

        cn_accum = cn if cn_accum is None else cn_accum + cn
        adf_accum = adf if adf_accum is None else adf_accum + adf
        od_accum = od if od_accum is None else od_accum + od
        for fold, q in ((3, q3), (4, q4), (5, q5)):
            q_raw[fold] = q if q_raw[fold] is None else np.concatenate((q_raw[fold], q), axis=1)
        bond_counts += _bond_count_matrix(bond, frame.count_list)
        n += 1

    n = max(1, n)
    cn_output = cn_accum / n
    column_sums = np.sum(cn_output, axis=0)
    cn_output[:, 1:] = np.divide(
        cn_output[:, 1:], column_sums[1:], out=np.zeros_like(cn_output[:, 1:]),
        where=column_sums[1:] != 0,
    ) * 100.0
    adf_output = adf_accum / n
    od_output = od_accum / n

    e_k = len(symbols)
    return {
        "cn": _series_output(cn_output, symbols, e_k, x_key="cn"),
        "adf": _series_output(adf_output, symbols, e_k, x_key="angle"),
        "orderParameter": _series_output(od_output, symbols, e_k, x_key="value"),
        "q": {
            "q3": _q_output(q_raw[3], symbols, n),
            "q4": _q_output(q_raw[4], symbols, n),
            "q5": _q_output(q_raw[5], symbols, n),
        },
        "bondCounts": [
            {"pair": f"{symbols[i]}-{symbols[j]}", "count": float(bond_counts[i, j] / n)}
            for i in range(e_k)
            for j in range(e_k)
        ],
    }


def compute_dynamics(
    frames: Sequence[Structure],
    indices: Sequence[int],
    symbols: Sequence[str],
    *,
    r_min: float,
    r_max: float,
    n_point: int,
    cutoff_angle: float,
    timestep: float,
) -> dict[str, object]:
    """MSD over time (total + per element) and the ALTBC map, via fastatomstruct."""
    import fastatomstruct as fs
    from pymatgen.io.ase import AseAtomsAdaptor

    symbols = list(symbols)
    atoms = [AseAtomsAdaptor.get_atoms(frames[index]) for index in indices]

    tbc = np.array(fs.altbc(atoms, r_min, r_max, n_point, cutoff_angle), dtype=float)
    # Peak-normalize so the map is in [0, 1] and comparable across datasets and
    # frame counts, regardless of how many frames were averaged.
    peak = float(tbc.max()) if tbc.size else 0.0
    if peak > 0:
        tbc = tbc / peak
    axis = np.linspace(r_min, r_max, n_point)

    time, total_msd = fs.mean_squared_displacement(atoms, timestep)
    # Per-atom squared displacement; average over each element's atoms to get
    # per-element MSD. Atom order follows the (grouped or not) frame order.
    per_atom_sd = np.array(fs.squared_displacement(atoms))
    site_symbols = [str(site.specie.symbol) for site in frames[indices[0]]]
    per_element = []
    for symbol in symbols:
        atom_indices = [i for i, value in enumerate(site_symbols) if value == symbol]
        if not atom_indices:
            continue
        per_element.append(
            {"element": symbol, "values": per_atom_sd[atom_indices].mean(axis=0).tolist()}
        )

    return {
        "altbc": {
            "rMin": r_min,
            "rMax": r_max,
            "nPoint": n_point,
            "axis": axis.tolist(),
            "matrix": tbc.tolist(),
        },
        "msd": {
            "time": np.array(time).tolist(),
            "total": np.array(total_msd).tolist(),
            "perElement": per_element,
        },
    }


def _series_output(
    data: np.ndarray,
    symbols: Sequence[str],
    e_k: int,
    *,
    x_key: str,
) -> dict[str, object]:
    return {
        x_key: data[:, 0].tolist(),
        "total": data[:, 1].tolist(),
        "perElement": [
            {"element": symbols[i], "values": data[:, 2 + i].tolist()} for i in range(e_k)
        ],
    }


def _q_output(q_raw: np.ndarray | None, symbols: Sequence[str], n: int) -> dict[str, object]:
    symbols = list(symbols)
    e_k = len(symbols)
    hist = np.zeros((101, 2 + e_k))
    hist[:, 0] = np.linspace(0.0, 1.0, 101)
    edges = hist[:, 0]
    if q_raw is not None and q_raw.shape[1] > 0:
        values = q_raw[0]
        elements = q_raw[1]
        hist[:-1, 1] = np.histogram(values, bins=edges)[0] / n
        for i in range(e_k):
            selected = values[elements == i]
            hist[:-1, 2 + i] = np.histogram(selected, bins=edges)[0] / n
    return {
        "value": hist[:, 0].tolist(),
        "total": hist[:, 1].tolist(),
        "perElement": [
            {"element": symbols[i], "values": hist[:, 2 + i].tolist()} for i in range(e_k)
        ],
    }


def _bond_count_matrix(bond: np.ndarray, count_list: Sequence[int]) -> np.ndarray:
    count_list = list(count_list)
    e_k = len(count_list) - 1
    matrix = np.zeros((e_k, e_k))
    for i in range(e_k):
        for j in range(e_k):
            matrix[i, j] = np.sum(
                bond[count_list[i] : count_list[i + 1], count_list[j] : count_list[j + 1]]
            )
    return matrix
