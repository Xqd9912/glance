"""Ring statistics over a periodic bond network.

The two reference notebooks compute ring statistics through heavy external
runtimes — OVITO's ``RingFinder`` C++ extension (``ovito-rings.ipynb``) and a
Julia package driven over PyCall (``julia-rings.ipynb``). Both are accurate but
too heavy to bundle in a lightweight, pip-installable web backend, and neither
integrates with the bond network the rest of :mod:`glance.analysis` already
builds from a per-element cutoff.

This module reimplements the same idea natively — pure NumPy plus the standard
library, on top of pymatgen's periodic neighbour search — so it ships with no
extra runtime dependency and reuses the project's cutoff conventions.

Ring definition
----------------
We count **shortest-path (primitive) rings**, the criterion both references
use. A ring is a simple cycle of atoms in which, for *every* pair of ring
atoms, the shorter arc of the ring between them is a topological shortest path
in the full bond graph (an *isometric* cycle). Equivalently, the ring cannot be
short-circuited by a shorter path through the rest of the network, so it cannot
be decomposed into smaller rings. This is the King/Franzblau "SP ring" reported
for network and phase-change materials.

Periodicity is handled exactly: each bond carries the lattice-image offset of
its endpoint, and a closed walk is only a genuine ring when the offsets sum to
zero. This rejects spurious cycles that merely wrap through periodic images.
"""

from __future__ import annotations

from collections import deque
from collections.abc import Sequence

import numpy as np
from pymatgen.core import Structure

RING_MIN_SIZE = 3
RING_MAX_SIZE = 9


class RingGraph:
    """Image-aware bond graph for a single frame.

    ``neighbors[i]`` is a list of ``(j, image)`` pairs where ``image`` is the
    integer lattice offset of neighbour ``j`` relative to atom ``i``. The
    topological (image-agnostic) adjacency is kept alongside for fast
    breadth-first shortest-path distances.
    """

    __slots__ = ("n", "neighbors", "adjacency")

    def __init__(self, n: int) -> None:
        self.n = n
        self.neighbors: list[list[tuple[int, tuple[int, int, int]]]] = [[] for _ in range(n)]
        self.adjacency: list[set[int]] = [set() for _ in range(n)]

    def add_edge(self, i: int, j: int, image: tuple[int, int, int]) -> None:
        self.neighbors[i].append((j, image))
        self.adjacency[i].add(j)


def build_ring_graph(
    structure: Structure,
    symbols: Sequence[str],
    cutoff_matrix: np.ndarray,
) -> RingGraph:
    """Build the periodic bond graph from a per-element-pair cutoff matrix.

    ``cutoff_matrix[a, b]`` is the maximum bond length between elements
    ``symbols[a]`` and ``symbols[b]`` (the same matrix the coordination kernel
    consumes). Bonds are the pymatgen periodic neighbours within that cutoff.
    """
    symbols = list(symbols)
    order = {symbol: index for index, symbol in enumerate(symbols)}
    site_element = np.array([order.get(str(site.specie.symbol), -1) for site in structure])

    max_cutoff = float(cutoff_matrix.max()) if cutoff_matrix.size else 0.0
    graph = RingGraph(len(structure))
    if max_cutoff <= 0.0:
        return graph

    # Only add each undirected bond once (i < j, or the i == j self-image case),
    # storing both directions with opposite image offsets.
    all_neighbors = structure.get_all_neighbors(max_cutoff)
    for i, neighbors in enumerate(all_neighbors):
        ei = site_element[i]
        if ei < 0:
            continue
        for neighbor in neighbors:
            j = int(neighbor.index)
            ej = site_element[j]
            if ej < 0:
                continue
            if float(neighbor.nn_distance) > float(cutoff_matrix[ei, ej]):
                continue
            image = (int(neighbor.image[0]), int(neighbor.image[1]), int(neighbor.image[2]))
            # De-duplicate: keep i < j, and for i == j keep the lexicographically
            # positive image so a bond and its mirror are not both stored.
            if j < i or (j == i and image <= (0, 0, 0)):
                continue
            graph.add_edge(i, j, image)
            graph.add_edge(j, i, (-image[0], -image[1], -image[2]))
    return graph


def _bfs_distances(graph: RingGraph, source: int, allowed_min: int, cap: int) -> dict[int, int]:
    """Topological shortest-path distances from ``source`` (image-agnostic).

    Restricted to atoms with index ``>= allowed_min`` and to paths no longer
    than ``cap`` hops — the canonical-root and ring-size bounds used by the
    search below.
    """
    distances = {source: 0}
    queue = deque([source])
    while queue:
        current = queue.popleft()
        depth = distances[current]
        if depth >= cap:
            continue
        for target in graph.adjacency[current]:
            if target < allowed_min or target in distances:
                continue
            distances[target] = depth + 1
            queue.append(target)
    return distances


def find_primitive_rings(
    graph: RingGraph,
    *,
    min_size: int = RING_MIN_SIZE,
    max_size: int = RING_MAX_SIZE,
) -> list[list[int]]:
    """Enumerate shortest-path (primitive) rings up to ``max_size`` atoms.

    Each ring is returned once as a list of atom indices whose smallest index
    is first. The search fixes the ring's minimum-index atom as the root and
    orients each cycle canonically, so every ring is found exactly once.
    """
    rings: list[list[int]] = []
    zero = (0, 0, 0)

    for root in range(graph.n):
        if not graph.neighbors[root]:
            continue
        # Distance from the root, over atoms >= root, bounds how far a partial
        # path may wander and still close within max_size.
        root_distance = _bfs_distances(graph, root, root, max_size)

        # Iterative DFS. Each stack entry is a partial simple path starting at
        # the root, the running image offset, and the set of atoms on the path.
        stack: list[tuple[list[int], tuple[int, int, int], set[int]]] = [
            ([root], zero, {root})
        ]
        while stack:
            path, offset, on_path = stack.pop()
            last = path[-1]
            path_len = len(path)
            for neighbor, image in graph.neighbors[last]:
                if neighbor < root:
                    continue
                new_offset = (
                    offset[0] + image[0],
                    offset[1] + image[1],
                    offset[2] + image[2],
                )
                if neighbor == root:
                    # A closed walk is a ring only if it returns to the same
                    # image (net zero offset) and is a genuine cycle (>= 3).
                    if path_len >= min_size and new_offset == zero:
                        if _is_primitive(graph, path, root_distance):
                            rings.append(list(path))
                    continue
                if neighbor in on_path:
                    continue
                # Prune: it must be possible to return to the root within budget.
                remaining = max_size - path_len
                back = root_distance.get(neighbor)
                if back is None or back > remaining:
                    continue
                new_path = [*path, neighbor]
                stack.append((new_path, new_offset, on_path | {neighbor}))

    # The canonical orientation (root first, then the smaller of the two
    # directions) makes each ring's tuple unique, so a set removes the
    # duplicate found from traversing a ring both ways.
    unique: dict[tuple[int, ...], list[int]] = {}
    for ring in rings:
        forward = tuple(ring)
        backward = (ring[0], *ring[:0:-1])
        key = min(forward, backward)
        unique[key] = list(key)
    return list(unique.values())


def _is_primitive(graph: RingGraph, ring: list[int], root_distance: dict[int, int]) -> bool:
    """Isometric (shortest-path) test for a candidate ring.

    For every pair of ring atoms the shorter arc along the ring must be a
    topological shortest path in the full graph. If any pair has a strictly
    shorter path through the rest of the network the ring is decomposable and
    is rejected.
    """
    size = len(ring)
    # The root's distances are already cached; other atoms are resolved lazily.
    distance_cache: dict[int, dict[int, int]] = {ring[0]: root_distance}
    for a in range(size):
        atom_a = ring[a]
        distances_a = distance_cache.get(atom_a)
        if distances_a is None:
            distances_a = _bfs_distances(graph, atom_a, 0, size)
            distance_cache[atom_a] = distances_a
        for b in range(a + 1, size):
            atom_b = ring[b]
            arc = b - a
            ring_distance = min(arc, size - arc)
            graph_distance = distances_a.get(atom_b, size + 1)
            if graph_distance < ring_distance:
                return False
    return True


def ring_size_counts(
    structure: Structure,
    symbols: Sequence[str],
    cutoff_matrix: np.ndarray,
    *,
    min_size: int = RING_MIN_SIZE,
    max_size: int = RING_MAX_SIZE,
) -> np.ndarray:
    """Ring-size histogram for one frame.

    Returns an array of length ``max_size - min_size + 1`` giving the number of
    primitive rings of each size from ``min_size`` to ``max_size``.
    """
    graph = build_ring_graph(structure, symbols, cutoff_matrix)
    rings = find_primitive_rings(graph, min_size=min_size, max_size=max_size)
    counts = np.zeros(max_size - min_size + 1, dtype=np.int64)
    for ring in rings:
        size = len(ring)
        if min_size <= size <= max_size:
            counts[size - min_size] += 1
    return counts
