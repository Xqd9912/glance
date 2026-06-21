import pytest
from httpx import ASGITransport, AsyncClient

from pretty_lattice.server.app import create_app


@pytest.mark.anyio
async def test_health_endpoint() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://testserver"
    ) as client:
        response = await client.get("/api/health")

        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


@pytest.mark.anyio
async def test_demo_scene_endpoint() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://testserver"
    ) as client:
        response = await client.get("/api/demo-scene")
        payload = response.json()

        assert response.status_code == 200
        assert payload["cell"]["vectors"]
        assert len(payload["atoms"]) >= 2
        assert payload["view"]["projection"] == "orthographic"


@pytest.mark.anyio
async def test_static_index_is_served_from_explicit_static_root(tmp_path) -> None:
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>Pretty Lattice</title>")

    async with AsyncClient(
        transport=ASGITransport(app=create_app(static_root=tmp_path, dev_static_fallback=False)),
        base_url="http://testserver",
    ) as client:
        response = await client.get("/")
        fallback_response = await client.get("/workspace")

        assert response.status_code == 200
        assert "Pretty Lattice" in response.text
        assert fallback_response.status_code == 200
        assert "Pretty Lattice" in fallback_response.text


@pytest.mark.anyio
async def test_missing_static_root_returns_actionable_page(tmp_path) -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app(static_root=tmp_path, dev_static_fallback=False)),
        base_url="http://testserver",
    ) as client:
        response = await client.get("/")

        assert response.status_code == 503
        assert "frontend is not built" in response.text
        assert "bun run build" in response.text
