from pathlib import Path

from pretty_lattice.server.app import create_app


app = create_app(static_root=Path(__file__).resolve().parents[1] / "web" / "dist")
