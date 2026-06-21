from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from ase import Atoms
from ase.io import read


class StructureReadError(ValueError):
    """Raised when a structure file cannot be parsed for preview."""


def read_structure(path: str | Path) -> Atoms:
    """Read a crystal structure with ASE."""
    structure_path = Path(path)
    try:
        atoms = read(structure_path)
    except Exception as exc:
        raise StructureReadError(
            f"Could not parse structure file {structure_path.name}: {exc}"
        ) from exc

    return _ensure_atoms(atoms, structure_path.name)


def read_structure_bytes(payload: bytes, filename: str | None = None) -> Atoms:
    if not payload:
        raise StructureReadError("Uploaded structure file is empty.")

    display_name = filename or "uploaded structure"
    safe_name = _safe_upload_name(display_name)
    try:
        with TemporaryDirectory(prefix="pretty-lattice-structure-") as temp_dir:
            structure_path = Path(temp_dir) / safe_name
            structure_path.write_bytes(payload)
            atoms = read(structure_path)
    except Exception as exc:
        raise StructureReadError(
            f"Could not parse {display_name} as an ASE-readable structure file: {exc}"
        ) from exc

    return _ensure_atoms(atoms, display_name)


def _safe_upload_name(filename: str) -> str:
    name = Path(filename).name.replace("\\", "_").replace("@", "_")
    if name in {"", ".", ".."}:
        return "uploaded-structure"
    return name


def _ensure_atoms(atoms: Atoms, display_name: str) -> Atoms:
    if not isinstance(atoms, Atoms):
        raise StructureReadError(f"Parsed {display_name}, but did not get an ASE Atoms object.")
    if len(atoms) == 0:
        raise StructureReadError(f"Parsed {display_name}, but it contains no atoms.")
    return atoms
