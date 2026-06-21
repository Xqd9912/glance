from __future__ import annotations

from pathlib import Path

from ase import Atoms
from ase.io import read


def read_structure(path: str | Path) -> Atoms:
    """Read a crystal structure with ASE."""
    return read(Path(path))
