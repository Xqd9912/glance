"""VASP volumetric-grid parsing (``CHGCAR``/``ELFCAR``), distributions, slicing.

VASP writes volumetric data on a regular grid with the first index fastest
(Fortran order). For ``CHGCAR`` the stored quantity is ``rho(r) * V_cell``, so
the grid average equals the total number of valence electrons; dividing every
point by that mean yields a dimensionless density relative to the cell average —
exactly the normalization the reference Fortran (``low_electron_density.f``)
performs when it divides by the hardcoded valence-electron count, but robust to
element and pseudopotential choice.

``ELFCAR`` shares the identical file layout but stores the electron localization
function, already a dimensionless number in ``[0, 1]``. It must **not** be
mean-normalized — the raw voxel values are the physical quantity — so ELFCAR is
parsed with normalization disabled.

"Low electron density" (LED) regions are grid points whose normalized density is
below an empirical threshold (``0.22`` for phase-change materials). The LED
*fraction* — the share of the cell below that threshold — tracks with the
amorphous/crystalline character of chalcogenides.

Both grids also support a *bonding-path profile*: the value (ELF or ρ/ρ̄)
averaged over a thin cylinder centered on the line joining two atoms, as a
function of distance along that line — a 1D view of how localization/charge
builds up between a bonded pair.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from pymatgen.core import Structure

DEFAULT_LED_THRESHOLD = 0.22
DEFAULT_BIN_WIDTH = 0.01
DEFAULT_MAX_DENSITY = 6.0
# ELF is bounded in [0, 1]; a coarser bin keeps the histogram legible.
DEFAULT_ELF_BIN_WIDTH = 0.02
# Guard rails on the volume held in memory for interactive slicing.
_MAX_GRID_POINTS = 600 * 600 * 600
# Marching cubes runs on a grid downsampled so its largest axis is at most this,
# keeping the isosurface mesh light enough to render and ship to the browser.
DEFAULT_ISOSURFACE_TARGET_DIM = 96
# Bonding-path profile defaults. A 0.5 A cylinder radius averages over roughly a
# 7-voxel diameter on a typical fine grid: enough voxels for a smooth curve while
# staying inside the bond channel and clear of neighboring atoms' basins.
DEFAULT_LINE_PROFILE_RADIUS = 0.5
DEFAULT_LINE_PROFILE_BINS = 120
# The profile scans the full grid; downsample so its largest axis is at most this
# to bound the per-request memory/CPU on very large CHGCAR grids.
DEFAULT_LINE_PROFILE_TARGET_DIM = 200


class ChgcarReadError(ValueError):
    """Raised when a CHGCAR/ELFCAR payload cannot be parsed."""


@dataclass
class ChgcarData:
    """Parsed VASP volumetric grid: metadata plus the value grid.

    ``density`` is indexed ``[iz, iy, ix]`` (z slowest) to match the Fortran
    write order once reshaped, and is stored as ``float32`` to halve resident
    memory for the large grids these files carry. For ``CHGCAR`` the grid is the
    mean-normalized density (mean == 1); for ``ELFCAR`` it is the raw ELF value.
    ``kind`` distinguishes the two and ``value_label`` names the plotted quantity.
    """

    symbols: list[str]
    counts: list[int]
    lattice: np.ndarray  # (3, 3) Cartesian lattice vectors in Angstrom
    grid: tuple[int, int, int]  # (nx, ny, nz)
    density: np.ndarray  # value grid, [nz, ny, nx], float32
    total_electrons: float  # grid mean of raw CHGCAR == integrated valence e-
    structure: Structure  # atoms + cell, for reusing the structure renderer
    kind: str = "chgcar"  # "chgcar" | "elfcar"
    value_label: str = "ρ / ρ̄"

    @property
    def atom_count(self) -> int:
        return int(sum(self.counts))

    def atom_labels(self) -> list[str]:
        """Per-site labels in LOBSTER style: element symbol + 1-based ordinal
        within that element (``Ge1 … Ge150``, ``Se1 …``), matching the ordering
        of the ICOHP/ICOOP lists so users can cross-reference an atom pair."""
        labels: list[str] = []
        for symbol, count in zip(self.symbols, self.counts, strict=True):
            labels.extend(f"{symbol}{ordinal}" for ordinal in range(1, count + 1))
        return labels


def _read_line(raw: bytes, pos: int) -> tuple[str, int]:
    end = raw.find(b"\n", pos)
    if end == -1:
        return raw[pos:].decode("latin1"), len(raw)
    return raw[pos:end].decode("latin1"), end + 1


def parse_chgcar(payload: bytes) -> ChgcarData:
    """Parse a CHGCAR payload into a mean-normalized :class:`ChgcarData`.

    Only the first (total-charge) data block is read; spin-density or
    augmentation-occupancy sections that follow are ignored.
    """
    return _parse_volumetric(payload, normalize=True, kind="chgcar", value_label="ρ / ρ̄")


def parse_elfcar(payload: bytes) -> ChgcarData:
    """Parse an ELFCAR payload into a :class:`ChgcarData`.

    ELFCAR uses the identical CHGCAR layout but stores the electron localization
    function, already dimensionless in ``[0, 1]``. The raw voxel values are kept
    (no mean normalization) so slices, isosurfaces and profiles read as true ELF.
    """
    return _parse_volumetric(payload, normalize=False, kind="elfcar", value_label="ELF")


def _parse_volumetric(
    payload: bytes, *, normalize: bool, kind: str, value_label: str
) -> ChgcarData:
    if not payload:
        raise ChgcarReadError(f"Uploaded {kind.upper()} file is empty.")

    try:
        pos = 0
        _comment, pos = _read_line(payload, pos)
        scale_line, pos = _read_line(payload, pos)
        scale = float(scale_line.split()[0])
        vectors = []
        for _ in range(3):
            line, pos = _read_line(payload, pos)
            vectors.append([float(value) for value in line.split()[:3]])
        lattice = np.array(vectors, dtype=float) * scale

        symbols_line, pos = _read_line(payload, pos)
        counts_line, pos = _read_line(payload, pos)
        symbols = symbols_line.split()
        counts = [int(value) for value in counts_line.split()]
        if not symbols or len(symbols) != len(counts):
            raise ChgcarReadError(
                "CHGCAR is missing an element/count header. Is this a VASP CHGCAR file?"
            )
        natoms = int(sum(counts))

        coord_mode, pos = _read_line(payload, pos)
        cartesian = coord_mode.strip()[:1].lower() in {"c", "k"}
        coords = []
        for _ in range(natoms):
            line, pos = _read_line(payload, pos)
            coords.append([float(value) for value in line.split()[:3]])
        _blank, pos = _read_line(payload, pos)
        grid_line, pos = _read_line(payload, pos)
        grid_tokens = grid_line.split()
        if len(grid_tokens) < 3:
            raise ChgcarReadError("Could not find the CHGCAR grid dimensions (NGXF NGYF NGZF).")
        nx, ny, nz = (int(grid_tokens[0]), int(grid_tokens[1]), int(grid_tokens[2]))
    except ChgcarReadError:
        raise
    except (ValueError, IndexError) as exc:
        raise ChgcarReadError(f"Could not parse CHGCAR header: {exc}") from exc

    n_points = nx * ny * nz
    if n_points <= 0:
        raise ChgcarReadError("CHGCAR grid dimensions must be positive.")
    if n_points > _MAX_GRID_POINTS:
        raise ChgcarReadError("CHGCAR grid is too large to load.")

    flat = np.fromstring(payload[pos:], sep=" ", count=n_points)
    if flat.size != n_points:
        raise ChgcarReadError(
            f"CHGCAR declares {n_points} grid points but only {flat.size} values were read."
        )

    mean = float(flat.mean())
    if not np.isfinite(mean):
        raise ChgcarReadError("Grid has a non-finite average value.")
    if normalize:
        if mean == 0.0:
            raise ChgcarReadError("CHGCAR grid has a zero average density.")
        density = (flat / mean).astype(np.float32).reshape(nz, ny, nx)
    else:
        density = flat.astype(np.float32).reshape(nz, ny, nx)

    species = [
        symbol for symbol, count in zip(symbols, counts, strict=True) for _ in range(count)
    ]
    try:
        structure = Structure(
            lattice,
            species,
            np.array(coords, dtype=float),
            coords_are_cartesian=cartesian,
        )
    except Exception as exc:
        raise ChgcarReadError(f"Could not build a structure from CHGCAR atoms: {exc}") from exc

    return ChgcarData(
        symbols=symbols,
        counts=counts,
        lattice=lattice,
        grid=(nx, ny, nz),
        density=density,
        total_electrons=mean,
        structure=structure,
        kind=kind,
        value_label=value_label,
    )


def led_distribution(
    data: ChgcarData,
    *,
    threshold: float = DEFAULT_LED_THRESHOLD,
    bin_width: float = DEFAULT_BIN_WIDTH,
    max_density: float = DEFAULT_MAX_DENSITY,
) -> dict[str, object]:
    """Histogram of the normalized density and the LED fraction.

    The curve is the share of grid points (in percent) falling in each
    ``bin_width``-wide normalized-density bin, matching the reference Fortran
    output. The LED fraction is the share of points in ``[0, threshold]``.
    """
    values = data.density.ravel()
    n = values.size
    edges = np.arange(0.0, max_density + bin_width, bin_width)
    counts, _ = np.histogram(values, bins=edges)
    percent = counts / n * 100.0
    centers = edges[:-1]

    led_fraction = float(np.count_nonzero((values >= 0.0) & (values <= threshold)) / n)
    return {
        "threshold": float(threshold),
        "binWidth": float(bin_width),
        "ledFraction": led_fraction,
        "density": centers.tolist(),
        "percent": percent.tolist(),
        "min": float(values.min()),
        "max": float(values.max()),
    }


def value_histogram(
    data: ChgcarData,
    *,
    bin_width: float = DEFAULT_ELF_BIN_WIDTH,
    vmin: float | None = None,
    vmax: float | None = None,
) -> dict[str, object]:
    """Histogram of the raw grid values as a percentage share per bin.

    Used for ELFCAR, where the quantity is bounded in ``[0, 1]`` and there is no
    LED-fraction analogue — just the statistical distribution of ELF values. The
    range defaults to the observed value range (clamped to ``0`` on the low end
    for ELF-like data).
    """
    values = data.density.ravel()
    n = int(values.size)
    lo = float(values.min()) if vmin is None else float(vmin)
    hi = float(values.max()) if vmax is None else float(vmax)
    if not np.isfinite(lo) or not np.isfinite(hi) or hi <= lo:
        hi = lo + max(bin_width, 1e-6)
    edges = np.arange(lo, hi + bin_width, bin_width)
    if edges.size < 2:
        edges = np.array([lo, lo + bin_width])
    counts, _ = np.histogram(values, bins=edges)
    percent = counts / n * 100.0 if n else counts.astype(float)
    return {
        "binWidth": float(bin_width),
        # Round the bin edges so float-accumulation noise (0.160000003) doesn't
        # leak into the histogram's axis labels.
        "value": np.round(edges[:-1], 6).tolist(),
        "percent": percent.tolist(),
        "min": float(values.min()),
        "max": float(values.max()),
        "mean": float(values.mean()),
    }


DEFAULT_NEIGHBOR_CUTOFF = 3.5


def atom_neighbors(
    data: ChgcarData, atom_i: int, *, r_cut: float = DEFAULT_NEIGHBOR_CUTOFF
) -> dict[str, object]:
    """Neighbors of ``atom_i`` within ``r_cut`` Angstrom, sorted near to far.

    Feeds the bonding-path picker: once the first atom is chosen, the second is
    restricted to its actual neighbors (nearest periodic image per site) so the
    profile is always drawn along a real bond. Each entry carries the bond length
    so the user can pick by distance.
    """
    if not (0 <= atom_i < data.atom_count):
        raise ChgcarReadError("Atom index out of range for this grid.")
    if r_cut <= 0:
        raise ChgcarReadError("Neighbor cutoff must be positive.")

    labels = data.atom_labels()
    site = data.structure[atom_i]
    nearest: dict[int, float] = {}
    for neighbor in data.structure.get_neighbors(site, r_cut):
        index = int(neighbor.index)
        if index == atom_i:
            continue  # skip self-images (a periodic copy of the same atom)
        distance = float(neighbor.nn_distance)
        if index not in nearest or distance < nearest[index]:
            nearest[index] = distance

    neighbors = [
        {"index": index, "label": labels[index], "distance": round(distance, 4)}
        for index, distance in nearest.items()
    ]
    neighbors.sort(key=lambda entry: entry["distance"])
    return {
        "atomI": int(atom_i),
        "labelI": labels[atom_i],
        "rCut": float(r_cut),
        "neighbors": neighbors,
    }


def line_profile(
    data: ChgcarData,
    atom_i: int,
    atom_j: int,
    *,
    radius: float = DEFAULT_LINE_PROFILE_RADIUS,
    n_bins: int = DEFAULT_LINE_PROFILE_BINS,
    target_dim: int = DEFAULT_LINE_PROFILE_TARGET_DIM,
) -> dict[str, object]:
    """Value profile along the line joining two atoms (a "bonding-path" scan).

    Voxels entering the average are those inside a cylinder of the given
    ``radius`` (Angstrom) whose axis is the segment from ``atom_i`` to ``atom_j``
    (nearest periodic image of ``atom_j``). Each contributing voxel is projected
    onto the axis to get its distance ``r`` from ``atom_i``; the mean grid value
    per ``r`` bin is returned — ELF localization or charge build-up along the
    bond. The minimum-image convention assumes the bond is shorter than half the
    cell, which holds for any real bonded pair.
    """
    n_atoms = data.atom_count
    if not (0 <= atom_i < n_atoms) or not (0 <= atom_j < n_atoms):
        raise ChgcarReadError("Atom index out of range for this grid.")
    if atom_i == atom_j:
        raise ChgcarReadError("Pick two distinct atoms for a bonding-path profile.")
    if radius <= 0:
        raise ChgcarReadError("Cylinder radius must be positive.")

    lattice = np.asarray(data.lattice, dtype=np.float64)
    frac = np.asarray(data.structure.frac_coords, dtype=np.float64)
    origin = frac[atom_i]
    delta = frac[atom_j] - origin
    delta -= np.round(delta)  # nearest periodic image of atom_j
    bond_vec = delta @ lattice
    length = float(np.linalg.norm(bond_vec))
    if length <= 0:
        raise ChgcarReadError("The two atoms coincide; cannot form a bond axis.")
    axis = (bond_vec / length).astype(np.float64)

    nx, ny, nz = data.grid
    step = max(1, int(np.ceil(max(nx, ny, nz) / max(1, target_dim))))
    values = data.density[::step, ::step, ::step].astype(np.float64)
    sz, sy, sx = values.shape

    # Fractional coordinate of each sampled voxel along a, b, c.
    fa = (np.arange(sx) * step) / nx
    fb = (np.arange(sy) * step) / ny
    fc = (np.arange(sz) * step) / nz
    # Minimum-image fractional displacement from atom_i, per axis.
    da = fa[None, None, :] - origin[0]
    db = fb[None, :, None] - origin[1]
    dc = fc[:, None, None] - origin[2]
    da -= np.round(da)
    db -= np.round(db)
    dc -= np.round(dc)
    # Cartesian displacement components (lattice rows are the cell vectors).
    cx = da * lattice[0, 0] + db * lattice[1, 0] + dc * lattice[2, 0]
    cy = da * lattice[0, 1] + db * lattice[1, 1] + dc * lattice[2, 1]
    cz = da * lattice[0, 2] + db * lattice[1, 2] + dc * lattice[2, 2]

    proj = cx * axis[0] + cy * axis[1] + cz * axis[2]  # distance along the axis
    perp_sq = (cx * cx + cy * cy + cz * cz) - proj * proj
    inside = (perp_sq <= radius * radius) & (proj >= 0.0) & (proj <= length)

    sel_r = proj[inside]
    sel_v = values[inside]
    edges = np.linspace(0.0, length, n_bins + 1)
    counts, _ = np.histogram(sel_r, bins=edges)
    sums, _ = np.histogram(sel_r, bins=edges, weights=sel_v)
    centers = (edges[:-1] + edges[1:]) / 2.0
    nonempty = counts > 0
    mean_values = np.zeros_like(sums)
    mean_values[nonempty] = sums[nonempty] / counts[nonempty]

    labels = data.atom_labels()
    return {
        "atomI": int(atom_i),
        "atomJ": int(atom_j),
        "labelI": labels[atom_i],
        "labelJ": labels[atom_j],
        "bondLength": length,
        "radius": float(radius),
        "valueLabel": data.value_label,
        "voxelCount": int(inside.sum()),
        "r": centers[nonempty].tolist(),
        "value": mean_values[nonempty].tolist(),
        "count": counts[nonempty].astype(int).tolist(),
    }


def slice_plane(data: ChgcarData, axis: str, index: int) -> dict[str, object]:
    """Extract a 2D slice of the normalized density perpendicular to ``axis``.

    ``axis`` is one of ``"a"``, ``"b"`` or ``"c"`` (the lattice directions,
    mapping to the x/y/z grid indices). The returned matrix is row-major and
    ready to feed the heatmap component.
    """
    nx, ny, nz = data.grid
    axis = axis.lower()
    if axis == "a":
        length, plane = nx, ("c", "b")
        index = _clamp_index(index, length)
        matrix = data.density[:, :, index]  # [nz, ny]
    elif axis == "b":
        length, plane = ny, ("c", "a")
        index = _clamp_index(index, length)
        matrix = data.density[:, index, :]  # [nz, nx]
    elif axis == "c":
        length, plane = nz, ("b", "a")
        index = _clamp_index(index, length)
        matrix = data.density[index, :, :]  # [ny, nx]
    else:
        raise ChgcarReadError(f"Unknown slice axis {axis!r}; expected 'a', 'b' or 'c'.")

    return {
        "axis": axis,
        "index": index,
        "count": length,
        "rowAxis": plane[0],
        "colAxis": plane[1],
        "matrix": np.asarray(matrix, dtype=float).tolist(),
    }


def _clamp_index(index: int, length: int) -> int:
    if length <= 0:
        return 0
    return max(0, min(int(index), length - 1))


@dataclass
class IsosurfaceMesh:
    """Iso-density surface: Cartesian vertices + triangle indices."""

    level: float
    vertices: np.ndarray  # (N, 3) float32, Cartesian Angstrom
    faces: np.ndarray  # (M, 3) uint32 triangle vertex indices
    density_min: float
    density_max: float

    @property
    def vertex_count(self) -> int:
        return int(self.vertices.shape[0])

    @property
    def triangle_count(self) -> int:
        return int(self.faces.shape[0])

    def pack_binary(self) -> bytes:
        """Little-endian: [uint32 nVerts][uint32 nTris][float32 verts][uint32 faces]."""
        header = np.array([self.vertex_count, self.triangle_count], dtype="<u4")
        return (
            header.tobytes()
            + self.vertices.astype("<f4").tobytes()
            + self.faces.astype("<u4").tobytes()
        )


def isosurface(
    data: ChgcarData,
    *,
    level: float,
    target_dim: int = DEFAULT_ISOSURFACE_TARGET_DIM,
) -> IsosurfaceMesh:
    """Triangulated iso-density surface at ``level`` (normalized units).

    Runs marching cubes on the (downsampled) grid and maps the vertices into the
    same Cartesian frame as the structure's atoms, so the mesh overlays the
    atoms/bonds directly. Vertex normals are left to the client to compute, which
    sidesteps normal-transform issues for non-orthogonal cells.
    """
    from skimage import measure

    nx, ny, nz = data.grid
    density_min = float(data.density.min())
    density_max = float(data.density.max())
    step = max(1, int(np.ceil(max(nx, ny, nz) / max(1, target_dim))))
    volume = data.density[::step, ::step, ::step]

    empty = IsosurfaceMesh(
        level=float(level),
        vertices=np.empty((0, 3), dtype=np.float32),
        faces=np.empty((0, 3), dtype=np.uint32),
        density_min=density_min,
        density_max=density_max,
    )
    if not (float(volume.min()) < level < float(volume.max())):
        return empty

    try:
        verts, faces, _normals, _values = measure.marching_cubes(
            np.ascontiguousarray(volume), level=level
        )
    except (ValueError, RuntimeError):
        return empty

    # Marching-cubes vertex axes are (c, b, a) in downsampled-index space. A
    # downsampled index j maps to original index j*step, so the fractional
    # coordinate along an axis of n points is j*step/n.
    frac = np.empty_like(verts)
    frac[:, 0] = verts[:, 2] * step / nx  # a
    frac[:, 1] = verts[:, 1] * step / ny  # b
    frac[:, 2] = verts[:, 0] * step / nz  # c
    cartesian = (frac @ data.lattice).astype(np.float32)

    return IsosurfaceMesh(
        level=float(level),
        vertices=cartesian,
        faces=faces.astype(np.uint32),
        density_min=density_min,
        density_max=density_max,
    )
