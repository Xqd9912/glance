from __future__ import annotations

from io import StringIO
from pathlib import Path

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
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise StructureReadError(f"Could not read {display_name} as UTF-8 text.") from exc

    errors: list[str] = []
    for structure_format in _candidate_formats(display_name, text):
        try:
            atoms = read(StringIO(text), format=structure_format)
        except Exception as exc:
            errors.append(f"{structure_format}: {exc}")
            continue
        return _ensure_atoms(atoms, display_name)

    detail = "; ".join(errors) if errors else "no supported parser was selected"
    raise StructureReadError(
        f"Could not parse {display_name} as a supported CIF or POSCAR-style structure ({detail})."
    )


def _candidate_formats(filename: str, text: str) -> tuple[str, ...]:
    name = Path(filename).name.lower()
    suffix = Path(name).suffix
    looks_like_cif = text.lstrip().startswith("data_") or "_cell_length_" in text
    looks_like_poscar = name in {"poscar", "contcar"} or suffix in {".poscar", ".vasp"}

    if suffix == ".cif" or looks_like_cif:
        return ("cif", "vasp")
    if looks_like_poscar:
        return ("vasp", "cif")
    return ("cif", "vasp")


def _ensure_atoms(atoms: Atoms, display_name: str) -> Atoms:
    if not isinstance(atoms, Atoms):
        raise StructureReadError(f"Parsed {display_name}, but did not get an ASE Atoms object.")
    if len(atoms) == 0:
        raise StructureReadError(f"Parsed {display_name}, but it contains no atoms.")
    return atoms
