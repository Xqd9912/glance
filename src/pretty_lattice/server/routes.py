from __future__ import annotations

from fastapi import APIRouter

from pretty_lattice.structures.scene import demo_scene

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/demo-scene")
def get_demo_scene() -> dict[str, object]:
    return demo_scene()
