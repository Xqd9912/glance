from __future__ import annotations

import json
from pathlib import Path

from pretty_lattice.structures.readers import read_structure
from pretty_lattice.structures.scene import build_scene_response

PROJECT_ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = PROJECT_ROOT / "tests" / "fixtures" / "structures" / "Sm(Mo3S4)2.cif"
OUTPUT_PATH = PROJECT_ROOT / "web" / "public" / "examples" / "SmMo3S4.scene.json"


def main() -> None:
    scene = build_scene_response(read_structure(INPUT_PATH))
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(scene, ensure_ascii=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
