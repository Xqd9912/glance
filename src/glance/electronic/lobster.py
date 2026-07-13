"""LOBSTER bonding-analysis outputs: BWDF and ICOHP/ICOOP pair lists.

LOBSTER projects plane-wave DFT onto a local orbital basis to quantify bonding.
This module parses the flat text files it writes so the browser can plot them:

* ``BWDF.lobster`` / ``BWDFCOHP.lobster`` — bond-weighted distribution function:
  two columns ``distance value``. A single curve/scatter of a bonding measure
  against bond length.
* ``ICOHPLIST.lobster`` — the integrated crystal-orbital Hamilton population for
  every bonded atom pair. Negative ICOHP means bonding, positive antibonding.
* ``ICOOPLIST.lobster`` — the integrated crystal-orbital overlap population, same
  layout as ICOHP (positive is bonding here).

The ICOHP/ICOOP lists share the identical column layout::

    COHP#  atomMU  atomNU  distance  tx ty tz  value

so both are parsed by :func:`parse_pair_list`. Each record is tagged with a
sorted element-pair label (``Ge-Ge``, ``Ge-Se``, ``Se-Se``) so the frontend can
offer per-pair-type toggles the way it does for the radial distribution g(r).
"""

from __future__ import annotations

import re

_ELEMENT_RE = re.compile(r"^([A-Za-z]+)")


class LobsterReadError(ValueError):
    """Raised when a LOBSTER payload cannot be parsed."""


def _element_of(label: str) -> str:
    """Strip the site index from a LOBSTER atom label: ``Ge53`` -> ``Ge``."""
    match = _ELEMENT_RE.match(label.strip())
    return match.group(1) if match else label.strip()


def _pair_label(element_a: str, element_b: str) -> str:
    """Order-independent element-pair label, e.g. ``Se-Ge`` -> ``Ge-Se``."""
    first, second = sorted((element_a, element_b))
    return f"{first}-{second}"


def parse_bwdf(payload: bytes) -> dict[str, object]:
    """Parse a two-column ``BWDF``-style file into ``{r, value}`` lists."""
    if not payload:
        raise LobsterReadError("Uploaded BWDF file is empty.")
    r: list[float] = []
    value: list[float] = []
    for raw in payload.decode("latin1").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        tokens = line.split()
        if len(tokens) < 2:
            continue
        try:
            r.append(float(tokens[0]))
            value.append(float(tokens[1]))
        except ValueError:
            # Header or comment row without a leading comment marker; skip it.
            continue
    if not r:
        raise LobsterReadError("No numeric BWDF rows found. Is this a BWDF.lobster file?")
    return {
        "r": r,
        "value": value,
        "min": min(value),
        "max": max(value),
    }


def parse_pair_list(payload: bytes, *, kind: str) -> dict[str, object]:
    """Parse an ``ICOHPLIST``/``ICOOPLIST`` file into per-pair records.

    ``kind`` is ``"icohp"`` or ``"icoop"`` and only labels the response. Rows
    whose first token is not an integer index (the two-line header, blank lines,
    any ``for spin`` markers) are skipped, so mixed single/collinear-spin files
    parse without special-casing.
    """
    if not payload:
        raise LobsterReadError(f"Uploaded {kind.upper()} file is empty.")

    records: list[dict[str, object]] = []
    pairs: set[str] = set()
    for raw in payload.decode("latin1").splitlines():
        tokens = raw.split()
        if len(tokens) < 8:
            continue
        if not tokens[0].isdigit():
            continue
        try:
            index = int(tokens[0])
            distance = float(tokens[3])
            value = float(tokens[7])
        except (ValueError, IndexError):
            continue
        atom_a, atom_b = tokens[1], tokens[2]
        element_a, element_b = _element_of(atom_a), _element_of(atom_b)
        pair = _pair_label(element_a, element_b)
        pairs.add(pair)
        records.append(
            {
                "index": index,
                "atomA": atom_a,
                "atomB": atom_b,
                "pair": pair,
                "distance": distance,
                "value": value,
            }
        )

    if not records:
        raise LobsterReadError(
            f"No {kind.upper()} rows found. Is this a {kind.upper()}LIST.lobster file?"
        )

    values = [record["value"] for record in records]
    distances = [record["distance"] for record in records]
    return {
        "kind": kind,
        "records": records,
        "pairs": sorted(pairs),
        "count": len(records),
        "valueRange": {"min": min(values), "max": max(values)},
        "distanceRange": {"min": min(distances), "max": max(distances)},
    }
