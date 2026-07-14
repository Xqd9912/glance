from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from glance.server.app import create_app


def _xdatcar_bytes(n_frames: int = 3) -> bytes:
    header = [
        "NaCl",
        "1.0",
        "5.0 0.0 0.0",
        "0.0 5.0 0.0",
        "0.0 0.0 5.0",
        "Na Cl",
        "4 4",
    ]
    base = [
        [0.0, 0.0, 0.0],
        [0.5, 0.0, 0.0],
        [0.0, 0.5, 0.0],
        [0.0, 0.0, 0.5],
        [0.5, 0.5, 0.0],
        [0.5, 0.0, 0.5],
        [0.0, 0.5, 0.5],
        [0.5, 0.5, 0.5],
    ]
    lines = list(header)
    for frame in range(n_frames):
        lines.append(f"Direct configuration=     {frame + 1}")
        for atom_index, coord in enumerate(base):
            shift = 0.01 * frame * (1 if atom_index == 0 else 0)
            lines.append(f"{coord[0] + shift:.6f} {coord[1]:.6f} {coord[2]:.6f}")
    return ("\n".join(lines) + "\n").encode()


async def _upload(client: AsyncClient) -> str:
    response = await client.post(
        "/api/trajectory",
        content=_xdatcar_bytes(),
        headers={"x-glance-filename": "XDATCAR"},
    )
    return response.json()["trajectoryId"]


@pytest.mark.anyio
async def test_analysis_gr_returns_curves_and_suggested_cutoffs() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://testserver"
    ) as client:
        trajectory_id = await _upload(client)
        response = await client.post(
            f"/api/trajectory/{trajectory_id}/analysis/gr",
            json={"frameStart": 0, "frameEnd": 3, "binWidth": 0.1, "rMax": 6.0},
        )

    body = response.json()
    assert response.status_code == 200
    assert body["symbols"] == ["Cl", "Na"]
    assert len(body["gr"]["r"]) == len(body["gr"]["total"])
    # Unordered element pairs: Cl-Cl, Cl-Na, Na-Na.
    assert [pair["label"] for pair in body["gr"]["pairs"]] == ["Cl-Cl", "Cl-Na", "Na-Na"]
    assert {tuple(c["elements"]) for c in body["suggestedCutoffs"]} == {
        ("Cl", "Cl"),
        ("Cl", "Na"),
        ("Na", "Na"),
    }


@pytest.mark.anyio
async def test_analysis_descriptors_returns_cn_adf_q() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://testserver"
    ) as client:
        trajectory_id = await _upload(client)
        response = await client.post(
            f"/api/trajectory/{trajectory_id}/analysis/descriptors",
            json={
                "frameStart": 0,
                "frameEnd": 3,
                "cutoffs": [
                    {"elements": ["Na", "Cl"], "distance": 3.0},
                    {"elements": ["Na", "Na"], "distance": 3.0},
                    {"elements": ["Cl", "Cl"], "distance": 3.0},
                ],
            },
        )

    body = response.json()
    descriptors = body["descriptors"]
    assert response.status_code == 200
    assert len(descriptors["cn"]["cn"]) == len(descriptors["cn"]["total"])
    assert len(descriptors["adf"]["angle"]) == 181
    assert {"q3", "q4", "q5"} <= set(descriptors["q"].keys())
    assert descriptors["bondCounts"]


@pytest.mark.anyio
async def test_analysis_rings_returns_per_frame_and_average() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://testserver"
    ) as client:
        trajectory_id = await _upload(client)
        response = await client.post(
            f"/api/trajectory/{trajectory_id}/analysis/rings",
            json={
                "frameStart": 0,
                "frameEnd": 3,
                "minSize": 3,
                "maxSize": 8,
                "cutoffs": [
                    {"elements": ["Na", "Cl"], "distance": 3.0},
                    {"elements": ["Na", "Na"], "distance": 3.0},
                    {"elements": ["Cl", "Cl"], "distance": 3.0},
                ],
            },
        )

    body = response.json()
    rings = body["rings"]
    assert response.status_code == 200
    assert rings["sizes"] == [3, 4, 5, 6, 7, 8]
    assert body["frameCount"] == 3
    assert len(rings["perFrame"]) == 3
    assert all(len(row) == len(rings["sizes"]) for row in rings["perFrame"])
    assert len(rings["mean"]) == len(rings["std"]) == len(rings["sizes"])


@pytest.mark.anyio
async def test_analysis_dynamics_returns_altbc_and_msd() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://testserver"
    ) as client:
        trajectory_id = await _upload(client)
        response = await client.post(
            f"/api/trajectory/{trajectory_id}/analysis/dynamics",
            json={"rMin": 1.0, "rMax": 4.0, "nPoint": 20, "cutoffAngle": 30.0, "timestep": 1.0},
        )

    body = response.json()
    dynamics = body["dynamics"]
    assert response.status_code == 200
    assert len(dynamics["altbc"]["matrix"]) == 20
    assert len(dynamics["altbc"]["matrix"][0]) == 20
    assert len(dynamics["msd"]["time"]) == len(dynamics["msd"]["total"]) == 3
    # Per-element MSD for both species (Na, Cl).
    assert {series["element"] for series in dynamics["msd"]["perElement"]} == {"Na", "Cl"}
    assert all(len(series["values"]) == 3 for series in dynamics["msd"]["perElement"])


@pytest.mark.anyio
async def test_analysis_rejects_empty_range_and_missing_trajectory() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://testserver"
    ) as client:
        trajectory_id = await _upload(client)
        empty = await client.post(
            f"/api/trajectory/{trajectory_id}/analysis/gr",
            json={"frameStart": 2, "frameEnd": 2},
        )
        missing = await client.post(
            "/api/trajectory/nope/analysis/gr", json={"frameStart": 0, "frameEnd": 1}
        )

    assert empty.status_code == 400
    assert missing.status_code == 404
