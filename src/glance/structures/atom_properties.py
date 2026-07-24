"""Per-site scalar properties used by structure coloring and filtering."""

from __future__ import annotations

from collections.abc import Iterator, Sequence
from dataclasses import dataclass

import numpy as np
from pymatgen.core import Structure

from glance.structures.schema import SceneSpec

PROPERTY_COORDINATION = "coordination.total"
PROPERTY_BOND_MIN = "bondDistance.min"
PROPERTY_BOND_MEAN = "bondDistance.mean"
PROPERTY_BOND_MAX = "bondDistance.max"
PROPERTY_DISPLACEMENT = "displacement.frame0"
PROPERTY_COORDINATION_ELEMENT_PREFIX = "coordination.element:"


class AtomPropertyError(ValueError):
    """Raised when an atom property request is invalid or unavailable."""


@dataclass(frozen=True)
class AtomPropertyValues:
    property_id: str
    label: str
    unit: str
    values: np.ndarray

    def response(self, domain: tuple[float, float] | None) -> dict[str, object]:
        result: dict[str, object] = {
            "propertyId": self.property_id,
            "label": self.label,
            "unit": self.unit,
            "values": [None if not np.isfinite(value) else float(value) for value in self.values],
        }
        if domain is not None:
            result["domain"] = {"min": domain[0], "max": domain[1]}
        return result


def validate_property_ids(
    property_ids: Sequence[str], *, elements: Sequence[str]
) -> tuple[str, ...]:
    valid = {
        PROPERTY_COORDINATION,
        PROPERTY_BOND_MIN,
        PROPERTY_BOND_MEAN,
        PROPERTY_BOND_MAX,
        PROPERTY_DISPLACEMENT,
    }
    available_elements = set(elements)
    normalized: list[str] = []
    for property_id in dict.fromkeys(property_ids):
        if property_id in valid:
            normalized.append(property_id)
            continue
        if property_id.startswith(PROPERTY_COORDINATION_ELEMENT_PREFIX):
            element = property_id.removeprefix(PROPERTY_COORDINATION_ELEMENT_PREFIX)
            if element in available_elements:
                normalized.append(property_id)
                continue
        raise AtomPropertyError(f"Unknown atom property: {property_id}.")
    if not normalized:
        raise AtomPropertyError("Request at least one atom property.")
    return tuple(normalized)


def scene_atom_properties(
    scene: SceneSpec,
    property_ids: Sequence[str],
    *,
    displacement: np.ndarray | None = None,
) -> dict[str, AtomPropertyValues]:
    """Compute canonical-site properties from the raw, unfiltered scene topology."""
    atom_count = int(scene["summary"]["atomCount"])
    atoms = scene["atoms"]
    incident_distances: list[list[float]] = [[] for _ in range(atom_count)]
    neighbor_elements: list[list[str]] = [[] for _ in range(atom_count)]

    for bond in scene["bonds"]:
        start = atoms[bond["startAtomIndex"]]
        end = atoms[bond["endAtomIndex"]]
        start_site = int(start["siteIndex"])
        end_site = int(end["siteIndex"])
        if not (0 <= start_site < atom_count and 0 <= end_site < atom_count):
            continue
        distance = float(
            np.linalg.norm(
                np.asarray(end["position"], dtype=np.float64)
                - np.asarray(start["position"], dtype=np.float64)
            )
        )
        # A bond to a periodic image of the same canonical site contributes two
        # incidences, matching the two endpoints of the physical bond record.
        incident_distances[start_site].append(distance)
        neighbor_elements[start_site].append(str(end["element"]))
        incident_distances[end_site].append(distance)
        neighbor_elements[end_site].append(str(start["element"]))

    result: dict[str, AtomPropertyValues] = {}
    for property_id in property_ids:
        if property_id == PROPERTY_COORDINATION:
            values = np.asarray([len(rows) for rows in incident_distances], dtype=np.float32)
            result[property_id] = AtomPropertyValues(
                property_id, "Coordination", "", values
            )
        elif property_id.startswith(PROPERTY_COORDINATION_ELEMENT_PREFIX):
            element = property_id.removeprefix(PROPERTY_COORDINATION_ELEMENT_PREFIX)
            values = np.asarray(
                [sum(value == element for value in rows) for rows in neighbor_elements],
                dtype=np.float32,
            )
            result[property_id] = AtomPropertyValues(
                property_id, f"Coordination by {element}", "", values
            )
        elif property_id in {PROPERTY_BOND_MIN, PROPERTY_BOND_MEAN, PROPERTY_BOND_MAX}:
            reducer = {
                PROPERTY_BOND_MIN: min,
                PROPERTY_BOND_MEAN: lambda rows: sum(rows) / len(rows),
                PROPERTY_BOND_MAX: max,
            }[property_id]
            values = np.asarray(
                [reducer(rows) if rows else np.nan for rows in incident_distances],
                dtype=np.float32,
            )
            label = {
                PROPERTY_BOND_MIN: "Minimum bond distance",
                PROPERTY_BOND_MEAN: "Mean bond distance",
                PROPERTY_BOND_MAX: "Maximum bond distance",
            }[property_id]
            result[property_id] = AtomPropertyValues(property_id, label, "Å", values)
        elif property_id == PROPERTY_DISPLACEMENT:
            if displacement is None or displacement.shape != (atom_count,):
                raise AtomPropertyError(
                    "Displacement is unavailable because trajectory atom identity changed."
                )
            result[property_id] = AtomPropertyValues(
                property_id,
                "Displacement from frame 0",
                "Å",
                np.asarray(displacement, dtype=np.float32),
            )
        else:  # pragma: no cover - validation rejects this path
            raise AtomPropertyError(f"Unknown atom property: {property_id}.")
    return result


def unwrap_trajectory_displacements(frames: Sequence[Structure]) -> np.ndarray:
    """Return ``|r_unwrapped(frame)-r_unwrapped(0)|`` for every frame and site."""
    return np.stack(tuple(iter_trajectory_displacements(frames)), axis=0)


def iter_trajectory_displacements(frames: Sequence[Structure]) -> Iterator[np.ndarray]:
    """Yield frame-zero displacement rows without retaining the whole trajectory."""
    _validate_trajectory_identity(frames)
    reference = np.asarray(frames[0].cart_coords, dtype=np.float64)
    unwrapped = reference.copy()
    previous_cartesian = reference
    yield np.zeros(len(frames[0]), dtype=np.float32)
    for frame in frames[1:]:
        current_cartesian = np.asarray(frame.cart_coords, dtype=np.float64)
        lattice_matrix = np.asarray(frame.lattice.matrix, dtype=np.float64)
        fractional_step = (current_cartesian - previous_cartesian) @ np.linalg.inv(
            lattice_matrix
        )
        for axis, periodic in enumerate(frame.lattice.pbc):
            if periodic:
                fractional_step[:, axis] -= np.round(fractional_step[:, axis])
        unwrapped = unwrapped + fractional_step @ lattice_matrix
        yield np.linalg.norm(unwrapped - reference, axis=1).astype(np.float32)
        previous_cartesian = current_cartesian


def unwrap_trajectory_positions(frames: Sequence[Structure]) -> np.ndarray:
    """Build sequential minimum-image Cartesian positions for a trajectory."""
    _validate_trajectory_identity(frames)
    atom_count = len(frames[0])
    unwrapped = np.zeros((len(frames), atom_count, 3), dtype=np.float64)
    unwrapped[0] = np.asarray(frames[0].cart_coords, dtype=np.float64)
    previous_cartesian = np.asarray(frames[0].cart_coords, dtype=np.float64)
    for frame_index, frame in enumerate(frames[1:], start=1):
        current_cartesian = np.asarray(frame.cart_coords, dtype=np.float64)
        lattice_matrix = np.asarray(frame.lattice.matrix, dtype=np.float64)
        # Include real Cartesian motion from a changing cell, then express that
        # step in the current lattice solely to apply the minimum-image wrap.
        fractional_step = (current_cartesian - previous_cartesian) @ np.linalg.inv(
            lattice_matrix
        )
        for axis, periodic in enumerate(frame.lattice.pbc):
            if periodic:
                fractional_step[:, axis] -= np.round(fractional_step[:, axis])
        cartesian_step = fractional_step @ lattice_matrix
        unwrapped[frame_index] = unwrapped[frame_index - 1] + cartesian_step
        previous_cartesian = current_cartesian

    return unwrapped


def _validate_trajectory_identity(frames: Sequence[Structure]) -> None:
    if not frames:
        raise AtomPropertyError("Trajectory contains no frames.")
    atom_count = len(frames[0])
    identities = tuple(str(site.species_string) for site in frames[0])
    if any(
        len(frame) != atom_count
        or tuple(str(site.species_string) for site in frame) != identities
        for frame in frames
    ):
        raise AtomPropertyError(
            "Displacement is unavailable because trajectory atom identity changed."
        )


def finite_domain(values: Sequence[np.ndarray]) -> tuple[float, float] | None:
    finite_rows = [row[np.isfinite(row)] for row in values]
    finite_rows = [row for row in finite_rows if row.size > 0]
    if not finite_rows:
        return None
    return (
        float(min(float(np.min(row)) for row in finite_rows)),
        float(max(float(np.max(row)) for row in finite_rows)),
    )


__all__ = [
    "PROPERTY_BOND_MAX",
    "PROPERTY_BOND_MEAN",
    "PROPERTY_BOND_MIN",
    "PROPERTY_COORDINATION",
    "PROPERTY_COORDINATION_ELEMENT_PREFIX",
    "PROPERTY_DISPLACEMENT",
    "AtomPropertyError",
    "AtomPropertyValues",
    "finite_domain",
    "iter_trajectory_displacements",
    "scene_atom_properties",
    "unwrap_trajectory_displacements",
    "unwrap_trajectory_positions",
    "validate_property_ids",
]
