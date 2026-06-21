from __future__ import annotations

from typing import Any


def demo_scene() -> dict[str, Any]:
    """Return a small crystal-like scene for wiring the initial GUI."""
    return {
        "cell": {
            "vectors": [
                [3.2, 0.0, 0.0],
                [0.0, 3.2, 0.0],
                [0.0, 0.0, 3.2],
            ]
        },
        "atoms": [
            {"id": "na-0", "element": "Na", "position": [0.0, 0.0, 0.0], "radius": 0.48},
            {"id": "cl-0", "element": "Cl", "position": [1.6, 1.6, 1.6], "radius": 0.56},
            {"id": "na-1", "element": "Na", "position": [3.2, 0.0, 0.0], "radius": 0.48},
            {"id": "cl-1", "element": "Cl", "position": [1.6, 1.6, -1.6], "radius": 0.56},
        ],
        "bonds": [
            {"from": "na-0", "to": "cl-0"},
            {"from": "na-0", "to": "cl-1"},
            {"from": "na-1", "to": "cl-0"},
        ],
        "view": {
            "projection": "orthographic",
            "preset": "three_quarter_c_up",
            "camera": {"position": [6.0, 5.0, 6.0], "target": [1.6, 1.2, 0.8]},
        },
    }
