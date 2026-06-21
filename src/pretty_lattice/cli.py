from __future__ import annotations

import socket
import webbrowser

import typer
import uvicorn

from pretty_lattice.server.app import create_app

app = typer.Typer(help="Pretty Lattice command line tools.")


@app.callback()
def main() -> None:
    """Pretty Lattice command line tools."""


def _choose_port(host: str, requested_port: int) -> int:
    if requested_port != 0:
        return requested_port

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((host, 0))
        return int(sock.getsockname()[1])


@app.command()
def gui(
    host: str = typer.Option("127.0.0.1", help="Host address for the local GUI server."),
    port: int = typer.Option(8765, help="Port for the local GUI server. Use 0 for any free port."),
    no_open: bool = typer.Option(False, "--no-open", help="Do not open the browser automatically."),
    reload: bool = typer.Option(False, help="Reload the server when Python files change."),
) -> None:
    """Start the local Pretty Lattice GUI server."""
    selected_port = _choose_port(host, port)
    url = f"http://{host}:{selected_port}"

    typer.echo(f"Starting Pretty Lattice GUI at {url}")
    if not no_open:
        webbrowser.open(url)

    if reload:
        uvicorn.run(
            "pretty_lattice.server.app:create_app",
            host=host,
            port=selected_port,
            factory=True,
            reload=True,
        )
        return

    uvicorn.run(create_app(), host=host, port=selected_port)
