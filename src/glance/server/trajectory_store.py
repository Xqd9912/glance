from __future__ import annotations

import threading
import uuid
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass, field

from glance.structures.schema import BondCutoffSpec, SceneSpec
from glance.structures.trajectory import TrajectoryData, read_trajectory_bytes

# The local server is single-user; keep only a couple of trajectories resident
# and bound the per-frame scene cache so memory stays predictable.
MAX_TRAJECTORIES = 2
SCENE_CACHE_CAPACITY = 256


@dataclass
class TrajectoryEntry:
    payload: bytes
    filename: str | None
    data: TrajectoryData
    scene_cache: OrderedDict[str, SceneSpec] = field(default_factory=OrderedDict)


class TrajectoryStore:
    def __init__(self) -> None:
        self._entries: OrderedDict[str, TrajectoryEntry] = OrderedDict()
        self._lock = threading.Lock()

    def create(
        self,
        payload: bytes,
        *,
        filename: str | None,
        type_map: dict[int, str] | None = None,
    ) -> tuple[str, TrajectoryEntry]:
        data = read_trajectory_bytes(payload, filename=filename, type_map=type_map)
        entry = TrajectoryEntry(payload=payload, filename=filename, data=data)
        trajectory_id = uuid.uuid4().hex
        with self._lock:
            self._entries[trajectory_id] = entry
            while len(self._entries) > MAX_TRAJECTORIES:
                self._entries.popitem(last=False)
        return trajectory_id, entry

    def get(self, trajectory_id: str) -> TrajectoryEntry | None:
        with self._lock:
            entry = self._entries.get(trajectory_id)
            if entry is not None:
                self._entries.move_to_end(trajectory_id)
            return entry

    def remap(self, trajectory_id: str, type_map: dict[int, str]) -> TrajectoryEntry | None:
        entry = self.get(trajectory_id)
        if entry is None:
            return None
        data = read_trajectory_bytes(
            entry.payload,
            filename=entry.filename,
            type_map=type_map,
        )
        entry.data = data
        entry.scene_cache.clear()
        return entry

    @staticmethod
    def cache_scene(
        entry: TrajectoryEntry,
        cache_key: str,
        build: Callable[[], SceneSpec],
    ) -> SceneSpec:
        cached = entry.scene_cache.get(cache_key)
        if cached is not None:
            entry.scene_cache.move_to_end(cache_key)
            return cached

        scene = build()
        entry.scene_cache[cache_key] = scene
        while len(entry.scene_cache) > SCENE_CACHE_CAPACITY:
            entry.scene_cache.popitem(last=False)
        return scene


def trajectory_metadata(trajectory_id: str, entry: TrajectoryEntry) -> dict[str, object]:
    frames = entry.data.frames
    first = frames[0]
    elements = sorted({str(species.symbol) for species in first.composition.elements})
    return {
        "trajectoryId": trajectory_id,
        "format": entry.data.fmt,
        "frameCount": len(frames),
        "atomCount": len(first),
        "elements": elements,
        "typeIds": entry.data.type_ids,
    }


def scene_cache_key(
    frame_index: int,
    bond_algorithm: str | None,
    cutoffs: list[BondCutoffSpec] | None,
) -> str:
    cutoff_signature = "none"
    if cutoffs:
        cutoff_signature = ";".join(
            f"{''.join(sorted(entry['elements']))}:{entry['distance']}" for entry in cutoffs
        )
    return f"{frame_index}|{bond_algorithm or 'default'}|{cutoff_signature}"
