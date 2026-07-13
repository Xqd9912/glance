from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

from pymatgen.core import Lattice, Structure
from pymatgen.core.periodic_table import Element

from glance.structures.readers import StructureReadError

# Trajectories are far larger than single structures; allow generous uploads
# while still bounding memory for the local server.
MAX_TRAJECTORY_UPLOAD_BYTES = 256 * 1024 * 1024


class TrajectoryReadError(StructureReadError):
    """Raised when a trajectory file cannot be parsed for preview."""


@dataclass(frozen=True)
class TrajectoryData:
    frames: list[Structure]
    fmt: str
    # For LAMMPS dumps only: the distinct integer atom types, so the UI can
    # prompt for a type -> element mapping.
    type_ids: list[int] | None = None


def read_trajectory_bytes(
    payload: bytes,
    *,
    filename: str | None = None,
    type_map: dict[int, str] | None = None,
) -> TrajectoryData:
    if not payload:
        raise TrajectoryReadError("Uploaded trajectory file is empty.")

    display_name = filename or "uploaded trajectory"
    fmt = detect_trajectory_format(payload, display_name)

    try:
        if fmt == "xdatcar":
            frames = _read_xdatcar(payload)
            type_ids = None
        elif fmt == "lammps-dump":
            frames, type_ids = _read_lammps_dump(payload, type_map=type_map)
        elif fmt == "xyz":
            frames = _read_extended_xyz(payload)
            type_ids = None
        else:  # pragma: no cover - detect_trajectory_format never returns else
            raise TrajectoryReadError(f"Unsupported trajectory format for {display_name}.")
    except TrajectoryReadError:
        raise
    except Exception as exc:
        raise TrajectoryReadError(f"Could not parse {display_name}: {exc}") from exc

    if not frames:
        raise TrajectoryReadError(f"Parsed {display_name}, but it contains no frames.")

    return TrajectoryData(frames=frames, fmt=fmt, type_ids=type_ids)


def detect_trajectory_format(payload: bytes, filename: str) -> str:
    name = Path(filename).name.lower()
    head = payload[:4096].decode("utf-8", errors="ignore")

    if "xdatcar" in name or "direct configuration=" in head.lower():
        return "xdatcar"
    if name.endswith(".dump") or name.endswith(".lammpstrj") or "ITEM: TIMESTEP" in head:
        return "lammps-dump"
    if name.endswith(".xyz") or "extxyz" in name:
        return "xyz"

    raise TrajectoryReadError(
        f"Could not recognize the trajectory format of {filename}. "
        "Supported formats: VASP XDATCAR, LAMMPS .dump, and .xyz."
    )


def _read_xdatcar(payload: bytes) -> list[Structure]:
    from pymatgen.io.vasp.outputs import Xdatcar

    with TemporaryDirectory(prefix="glance-traj-") as temp_dir:
        path = Path(temp_dir) / "XDATCAR"
        path.write_bytes(payload)
        return list(Xdatcar(str(path)).structures)


def _read_lammps_dump(
    payload: bytes,
    *,
    type_map: dict[int, str] | None,
) -> tuple[list[Structure], list[int]]:
    from pymatgen.io.lammps.outputs import parse_lammps_dumps

    with TemporaryDirectory(prefix="glance-traj-") as temp_dir:
        path = Path(temp_dir) / "traj.dump"
        path.write_bytes(payload)
        dumps = list(parse_lammps_dumps(str(path)))

    if not dumps:
        raise TrajectoryReadError("No frames found in the LAMMPS dump.")

    type_ids = sorted({int(value) for value in dumps[0].data["type"].tolist()})
    resolved_map = _resolve_type_map(type_ids, type_map)

    frames: list[Structure] = []
    for dump in dumps:
        data = dump.data.sort_values("id") if "id" in dump.data else dump.data
        lattice = dump.box.to_lattice()
        species = [resolved_map[int(value)] for value in data["type"].tolist()]
        if {"xs", "ys", "zs"}.issubset(data.columns):
            coords = data[["xs", "ys", "zs"]].to_numpy()
            frames.append(Structure(lattice, species, coords, coords_are_cartesian=False))
        else:
            coords = data[["x", "y", "z"]].to_numpy()
            frames.append(Structure(lattice, species, coords, coords_are_cartesian=True))

    return frames, type_ids


def _resolve_type_map(
    type_ids: list[int],
    type_map: dict[int, str] | None,
) -> dict[int, str]:
    resolved: dict[int, str] = {}
    for type_id in type_ids:
        symbol = (type_map or {}).get(type_id)
        if symbol:
            resolved[type_id] = symbol
            continue
        # Fall back to the element whose atomic number equals the type id, so
        # the frame renders with a valid (if placeholder) species the user can
        # remap in the UI.
        try:
            resolved[type_id] = Element.from_Z(type_id).symbol
        except Exception:
            resolved[type_id] = "H"
    return resolved


def _read_extended_xyz(payload: bytes) -> list[Structure]:
    text = payload.decode("utf-8", errors="ignore")
    lines = text.splitlines()
    frames: list[Structure] = []
    index = 0
    total = len(lines)

    while index < total:
        if not lines[index].strip():
            index += 1
            continue

        atom_count = int(lines[index].strip())
        comment = lines[index + 1] if index + 1 < total else ""
        atom_lines = lines[index + 2 : index + 2 + atom_count]
        if len(atom_lines) < atom_count:
            raise TrajectoryReadError("Truncated frame in .xyz trajectory.")

        species: list[str] = []
        coords: list[list[float]] = []
        for atom_line in atom_lines:
            parts = atom_line.split()
            species.append(parts[0])
            coords.append([float(parts[1]), float(parts[2]), float(parts[3])])

        frames.append(_build_xyz_frame(species, coords, comment))
        index += 2 + atom_count

    return frames


def _build_xyz_frame(
    species: list[str],
    coords: list[list[float]],
    comment: str,
) -> Structure:
    lattice_matrix = _parse_extxyz_lattice(comment)
    if lattice_matrix is not None:
        return Structure(
            Lattice(lattice_matrix),
            species,
            coords,
            coords_are_cartesian=True,
        )

    # No cell in the comment: render as a non-periodic cluster inside a padded box.
    return _non_periodic_structure(species, coords)


def _parse_extxyz_lattice(comment: str) -> list[list[float]] | None:
    match = re.search(r'Lattice\s*=\s*"([^"]+)"', comment)
    if match is None:
        return None

    values = [float(value) for value in match.group(1).split()]
    if len(values) != 9:
        return None

    return [values[0:3], values[3:6], values[6:9]]


def _non_periodic_structure(species: list[str], coords: list[list[float]]) -> Structure:
    minima = [min(coord[axis] for coord in coords) for axis in range(3)]
    maxima = [max(coord[axis] for coord in coords) for axis in range(3)]
    padding = 5.0
    lengths = [maxima[axis] - minima[axis] + 2 * padding for axis in range(3)]
    shifted = [[coord[axis] - minima[axis] + padding for axis in range(3)] for coord in coords]
    lattice = Lattice.from_parameters(
        max(lengths[0], 1.0),
        max(lengths[1], 1.0),
        max(lengths[2], 1.0),
        90.0,
        90.0,
        90.0,
        pbc=(False, False, False),
    )
    return Structure(lattice, species, shifted, coords_are_cartesian=True)
