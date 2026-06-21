from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass
from functools import lru_cache
from importlib import resources
from pathlib import Path
from typing import Any

from pretty_lattice.structures.elements import normalize_symbol

DEFAULT_COLORMAP = "vesta"
_HEX_COLOR_RE = re.compile(r"^#?[0-9a-fA-F]{6}$")


class ColormapError(ValueError):
    """Raised when bundled colormap data cannot be resolved."""


@dataclass(frozen=True, slots=True)
class Colormap:
    name: str
    records: dict[str, str]

    def resolve(self, symbol: str) -> str:
        normalized = normalize_symbol(symbol)
        try:
            return self.records[normalized]
        except KeyError as exc:
            raise ColormapError(
                f"No bundled color for element {symbol!r} in colormap {self.name!r}."
            ) from exc


@lru_cache
def load_colormap(name: str = DEFAULT_COLORMAP, path: str | Path | None = None) -> Colormap:
    if path is None:
        _validate_colormap_name(name)
        resource = resources.files("pretty_lattice").joinpath(f"data/colormaps/{name}.toml")
        payload = resource.read_bytes()
    else:
        payload = Path(path).read_bytes()

    data = tomllib.loads(payload.decode("utf-8"))
    raw_elements = data.get("elements")
    if not isinstance(raw_elements, dict):
        raise ColormapError("Colormap must contain [elements].")

    records: dict[str, str] = {}
    for raw_symbol, raw_record in raw_elements.items():
        symbol = normalize_symbol(raw_symbol)
        if not isinstance(raw_record, dict):
            raise ColormapError(f"Invalid colormap record for {symbol}.")
        records[symbol] = _parse_color_record(symbol, raw_record)

    return Colormap(name=name, records=records)


def resolve_color(symbol: str, colormap: Colormap | None = None) -> str:
    return (colormap or load_colormap()).resolve(symbol)


def _validate_colormap_name(name: str) -> None:
    if not name or "/" in name or "\\" in name:
        raise ColormapError(f"Invalid colormap name {name!r}.")


def _parse_color_record(symbol: str, raw_record: dict[str, Any]) -> str:
    color_keys = {"hex", "rgb"}
    unknown_keys = set(raw_record) - color_keys
    if unknown_keys:
        unknown = ", ".join(sorted(unknown_keys))
        raise ColormapError(f"Colormap record for {symbol} has unknown keys: {unknown}.")

    present_formats = [key for key in color_keys if key in raw_record]
    if len(present_formats) != 1:
        raise ColormapError(f"Colormap record for {symbol} must define exactly one color format.")

    if present_formats[0] == "hex":
        return _parse_hex_color(symbol, raw_record["hex"])
    return _parse_rgb_color(symbol, raw_record["rgb"])


def _parse_hex_color(symbol: str, value: Any) -> str:
    if not isinstance(value, str):
        raise ColormapError(f"Colormap hex color for {symbol} must be a string.")
    normalized = value.strip()
    if _HEX_COLOR_RE.fullmatch(normalized) is None:
        raise ColormapError(f"Colormap hex color for {symbol} must be #RRGGBB.")
    return f"#{normalized.removeprefix('#').lower()}"


def _parse_rgb_color(symbol: str, value: Any) -> str:
    if not isinstance(value, list | tuple) or len(value) != 3:
        raise ColormapError(f"Colormap RGB color for {symbol} must be a three-item array.")

    channels: list[int] = []
    for channel in value:
        if (
            not isinstance(channel, int)
            or isinstance(channel, bool)
            or channel < 0
            or channel > 255
        ):
            raise ColormapError(f"Colormap RGB color for {symbol} must use 0-255 integers.")
        channels.append(channel)

    return f"#{channels[0]:02x}{channels[1]:02x}{channels[2]:02x}"
