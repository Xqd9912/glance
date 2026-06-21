from pretty_lattice.cli import _choose_port


def test_choose_requested_port() -> None:
    assert _choose_port("127.0.0.1", 8765) == 8765


def test_choose_free_port() -> None:
    port = _choose_port("127.0.0.1", 0)

    assert port > 0
