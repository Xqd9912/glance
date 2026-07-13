"""In-memory store for parsed VASP volumetric grids (CHGCAR/ELFCAR).

These files are large (hundreds of MB) so we parse the payload once, keep the
``float32`` grid resident, and let the client scrub through slices, isosurfaces
and bonding-path profiles by id rather than re-uploading. The local server is
single-user, so only a couple of grids are kept resident at a time.
"""

from __future__ import annotations

import threading
import uuid
from collections import OrderedDict

from glance.electronic.chgcar import ChgcarData, parse_chgcar, parse_elfcar

MAX_GRIDS = 2


class ElectronicStore:
    def __init__(self) -> None:
        self._entries: OrderedDict[str, ChgcarData] = OrderedDict()
        self._lock = threading.Lock()

    def create(self, payload: bytes, *, kind: str = "chgcar") -> tuple[str, ChgcarData]:
        data = parse_elfcar(payload) if kind == "elfcar" else parse_chgcar(payload)
        grid_id = uuid.uuid4().hex
        with self._lock:
            self._entries[grid_id] = data
            while len(self._entries) > MAX_GRIDS:
                self._entries.popitem(last=False)
        return grid_id, data

    def get(self, grid_id: str) -> ChgcarData | None:
        with self._lock:
            data = self._entries.get(grid_id)
            if data is not None:
                self._entries.move_to_end(grid_id)
            return data


def chgcar_metadata(grid_id: str, data: ChgcarData) -> dict[str, object]:
    nx, ny, nz = data.grid
    labels = data.atom_labels()
    return {
        "chgcarId": grid_id,
        "gridId": grid_id,
        "kind": data.kind,
        "valueLabel": data.value_label,
        "symbols": data.symbols,
        "counts": data.counts,
        "atomCount": data.atom_count,
        "atoms": [
            {"index": index, "label": label, "element": label.rstrip("0123456789")}
            for index, label in enumerate(labels)
        ],
        "grid": {"nx": nx, "ny": ny, "nz": nz},
        "totalElectrons": data.total_electrons,
    }
