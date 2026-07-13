from __future__ import annotations

import json
from urllib.parse import quote

import pytest
from httpx import ASGITransport, AsyncClient

from glance.server.app import create_app
from glance.structures.trajectory import (
    TrajectoryReadError,
    detect_trajectory_format,
    read_trajectory_bytes,
)

XDATCAR_BYTES = b"""NaCl
1.0
5.64 0.0 0.0
0.0 5.64 0.0
0.0 0.0 5.64
Na Cl
1 1
Direct configuration=     1
0.00 0.00 0.00
0.50 0.50 0.50
Direct configuration=     2
0.02 0.00 0.00
0.50 0.50 0.50
"""

DUMP_BYTES = b"""ITEM: TIMESTEP
0
ITEM: NUMBER OF ATOMS
2
ITEM: BOX BOUNDS pp pp pp
0.0 5.0
0.0 5.0
0.0 5.0
ITEM: ATOMS id type x y z
2 2 2.5 2.5 2.5
1 1 0.0 0.0 0.0
ITEM: TIMESTEP
1
ITEM: NUMBER OF ATOMS
2
ITEM: BOX BOUNDS pp pp pp
0.0 5.0
0.0 5.0
0.0 5.0
ITEM: ATOMS id type x y z
1 1 0.1 0.0 0.0
2 2 2.5 2.5 2.5
"""

XYZ_BYTES = b"""2
Lattice="5.0 0.0 0.0 0.0 5.0 0.0 0.0 0.0 5.0" pbc="T T T"
Ge 0.0 0.0 0.0
Te 2.5 2.5 2.5
2
Lattice="5.0 0.0 0.0 0.0 5.0 0.0 0.0 0.0 5.0"
Ge 0.1 0.0 0.0
Te 2.5 2.5 2.5
"""

XYZ_NO_LATTICE_BYTES = b"""2
a cluster frame with no lattice
Ge 0.0 0.0 0.0
Te 1.5 0.0 0.0
"""


def test_detect_trajectory_format_by_content_and_name() -> None:
    assert detect_trajectory_format(XDATCAR_BYTES, "XDATCAR") == "xdatcar"
    assert detect_trajectory_format(DUMP_BYTES, "run.dump") == "lammps-dump"
    assert detect_trajectory_format(XYZ_BYTES, "traj.xyz") == "xyz"


def test_detect_trajectory_format_rejects_unknown() -> None:
    with pytest.raises(TrajectoryReadError, match="Could not recognize"):
        detect_trajectory_format(b"random text", "mystery.txt")


def test_read_xdatcar_frames() -> None:
    trajectory = read_trajectory_bytes(XDATCAR_BYTES, filename="XDATCAR")

    assert trajectory.fmt == "xdatcar"
    assert len(trajectory.frames) == 2
    assert [str(site.specie) for site in trajectory.frames[0]] == ["Na", "Cl"]
    assert trajectory.frames[0].lattice.pbc == (True, True, True)
    # The Na atom moved between frames.
    assert trajectory.frames[0][0].frac_coords[0] != trajectory.frames[1][0].frac_coords[0]


def test_read_dump_defaults_to_atomic_number_species_then_remaps() -> None:
    default_trajectory = read_trajectory_bytes(DUMP_BYTES, filename="run.dump")
    mapped_trajectory = read_trajectory_bytes(
        DUMP_BYTES,
        filename="run.dump",
        type_map={1: "Ge", 2: "Te"},
    )

    assert default_trajectory.type_ids == [1, 2]
    # Default placeholder species use the element with matching atomic number.
    assert {str(site.specie) for site in default_trajectory.frames[0]} == {"H", "He"}
    # Atoms are ordered by id even when the dump lists them out of order.
    assert [str(site.specie) for site in mapped_trajectory.frames[0]] == ["Ge", "Te"]
    assert len(mapped_trajectory.frames) == 2


def test_read_extended_xyz_uses_lattice_and_falls_back_to_non_periodic() -> None:
    periodic = read_trajectory_bytes(XYZ_BYTES, filename="traj.xyz")
    non_periodic = read_trajectory_bytes(XYZ_NO_LATTICE_BYTES, filename="cluster.xyz")

    assert len(periodic.frames) == 2
    assert periodic.frames[0].lattice.pbc == (True, True, True)
    assert periodic.frames[0].lattice.a == pytest.approx(5.0)
    assert non_periodic.frames[0].lattice.pbc == (False, False, False)


def test_read_trajectory_rejects_empty_payload() -> None:
    with pytest.raises(TrajectoryReadError, match="empty"):
        read_trajectory_bytes(b"", filename="XDATCAR")


@pytest.mark.anyio
async def test_trajectory_upload_and_frame_endpoints() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://testserver"
    ) as client:
        upload = await client.post(
            "/api/trajectory",
            content=XDATCAR_BYTES,
            headers={"x-glance-filename": "XDATCAR"},
        )
        meta = upload.json()

        assert upload.status_code == 200
        assert meta["format"] == "xdatcar"
        assert meta["frameCount"] == 2
        assert meta["atomCount"] == 2
        assert meta["elements"] == ["Cl", "Na"]

        trajectory_id = meta["trajectoryId"]
        frame = await client.get(f"/api/trajectory/{trajectory_id}/frames/1")

        assert frame.status_code == 200
        assert frame.json()["summary"]["atomCount"] == 2
        assert "bondCutoffs" in frame.json()


@pytest.mark.anyio
async def test_trajectory_dump_type_map_update() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://testserver"
    ) as client:
        upload = await client.post(
            "/api/trajectory",
            content=DUMP_BYTES,
            headers={"x-glance-filename": "run.dump"},
        )
        meta = upload.json()

        assert meta["typeIds"] == [1, 2]

        trajectory_id = meta["trajectoryId"]
        remap = await client.post(
            f"/api/trajectory/{trajectory_id}/type-map"
            f"?typeMap={quote(json.dumps({'1': 'Ge', '2': 'Te'}))}"
        )

        assert remap.status_code == 200
        assert remap.json()["elements"] == ["Ge", "Te"]


@pytest.mark.anyio
async def test_trajectory_frame_out_of_range_and_missing_trajectory() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://testserver"
    ) as client:
        upload = await client.post(
            "/api/trajectory",
            content=XDATCAR_BYTES,
            headers={"x-glance-filename": "XDATCAR"},
        )
        trajectory_id = upload.json()["trajectoryId"]

        out_of_range = await client.get(f"/api/trajectory/{trajectory_id}/frames/99")
        missing = await client.get("/api/trajectory/does-not-exist/frames/0")

        assert out_of_range.status_code == 404
        assert missing.status_code == 404


@pytest.mark.anyio
async def test_trajectory_rejects_invalid_type_map() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://testserver"
    ) as client:
        response = await client.post(
            "/api/trajectory?typeMap=not-json",
            content=DUMP_BYTES,
            headers={"x-glance-filename": "run.dump"},
        )

        assert response.status_code == 400
        assert "JSON" in response.json()["detail"]["message"]
