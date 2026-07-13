from __future__ import annotations

import json
from importlib.resources import files
from itertools import combinations_with_replacement

from pymatgen.core import Structure

from glance.structures.schema import BondCutoffSpec

# Sum-of-covalent-radii is a typical single-bond length; the tolerance adds a
# margin so slightly stretched contacts are still detected as bonds by default.
BOND_CUTOFF_TOLERANCE = 1.15

# Used when an element is missing from the covalent radii table so a structure
# always gets usable default cutoffs.
FALLBACK_COVALENT_RADIUS = 1.5

_COVALENT_RADII: dict[str, float] = {
    symbol: float(radius)
    for symbol, radius in json.loads(
        files(__package__).joinpath("covalent_radii.json").read_text()
    )["radii"].items()
}


def covalent_radius(element: str) -> float:
    return _COVALENT_RADII.get(element, FALLBACK_COVALENT_RADIUS)


def default_bond_cutoff(first_element: str, second_element: str) -> float:
    radius_sum = covalent_radius(first_element) + covalent_radius(second_element)
    return round(radius_sum * BOND_CUTOFF_TOLERANCE, 2)


def default_bond_cutoffs_for_structure(structure: Structure) -> list[BondCutoffSpec]:
    elements = sorted({element.symbol for element in structure.composition.elements})
    return [
        {
            "elements": [first_element, second_element],
            "distance": default_bond_cutoff(first_element, second_element),
        }
        for first_element, second_element in combinations_with_replacement(elements, 2)
    ]


def cutoff_lookup_from_specs(
    cutoffs: list[BondCutoffSpec],
) -> dict[tuple[str, str], float]:
    lookup: dict[tuple[str, str], float] = {}
    for cutoff in cutoffs:
        elements = cutoff["elements"]
        if len(elements) != 2:
            continue
        distance = float(cutoff["distance"])
        if distance <= 0:
            continue
        lookup[(elements[0], elements[1])] = distance
    return lookup
