from __future__ import annotations

from collections.abc import Sequence
from typing import TypedDict

from ase import Atoms

from pretty_lattice.structures.colormaps import Colormap, load_colormap
from pretty_lattice.structures.elements import ElementRegistry, load_element_registry


class CellSpec(TypedDict):
    vectors: list[list[float]]


class AtomSpec(TypedDict):
    id: str
    element: str
    position: list[float]
    radius: float
    color: str


class SceneSpec(TypedDict):
    cell: CellSpec
    atoms: list[AtomSpec]


def build_scene_response(
    atoms: Atoms,
    *,
    element_registry: ElementRegistry | None = None,
    colormap: Colormap | None = None,
) -> SceneSpec:
    elements = element_registry or load_element_registry()
    colors = colormap or load_colormap()

    scene_atoms: list[AtomSpec] = []
    for index, (symbol, position) in enumerate(
        zip(atoms.get_chemical_symbols(), atoms.positions, strict=True)
    ):
        element = elements.resolve(symbol)
        scene_atoms.append(
            {
                "id": f"{element.symbol}-{index}",
                "element": element.symbol,
                "position": _vector3(position),
                "radius": element.atomic_radius,
                "color": colors.resolve(element.symbol),
            }
        )

    return {
        "cell": {"vectors": [_vector3(vector) for vector in atoms.cell.array]},
        "atoms": scene_atoms,
    }


def _vector3(values: Sequence[float]) -> list[float]:
    return [float(values[0]), float(values[1]), float(values[2])]
