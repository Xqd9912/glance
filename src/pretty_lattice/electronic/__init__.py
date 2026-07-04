"""Electronic-property analysis: charge density, DOS and IPR.

Parsers and per-file computations for the electronic module:

* :mod:`pretty_lattice.electronic.chgcar` — VASP volumetric grids
  (``CHGCAR``/``ELFCAR``): value grid, LED / value distributions, orthogonal
  slices, isosurfaces and bonding-path (cylinder) profiles.
* :mod:`pretty_lattice.electronic.lobster` — LOBSTER bonding outputs: ``BWDF``
  curves and ``ICOHPLIST``/``ICOOPLIST`` per-pair populations.
* :mod:`pretty_lattice.electronic.dos` — ``TDOS.dat`` total density of states.
* :mod:`pretty_lattice.electronic.ipr` — inverse participation ratio from a
  VASP ``vasprun.xml`` (with the total DOS on a shared energy axis).
"""

from __future__ import annotations

from pretty_lattice.electronic.chgcar import (
    ChgcarData,
    ChgcarReadError,
    atom_neighbors,
    isosurface,
    led_distribution,
    line_profile,
    parse_chgcar,
    parse_elfcar,
    slice_plane,
    value_histogram,
)
from pretty_lattice.electronic.dos import DosReadError, parse_tdos
from pretty_lattice.electronic.ipr import IprReadError, compute_ipr
from pretty_lattice.electronic.lobster import (
    LobsterReadError,
    parse_bwdf,
    parse_pair_list,
)

__all__ = [
    "ChgcarData",
    "ChgcarReadError",
    "DosReadError",
    "IprReadError",
    "LobsterReadError",
    "atom_neighbors",
    "compute_ipr",
    "isosurface",
    "led_distribution",
    "line_profile",
    "parse_bwdf",
    "parse_chgcar",
    "parse_elfcar",
    "parse_pair_list",
    "parse_tdos",
    "slice_plane",
    "value_histogram",
]
