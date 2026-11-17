#!/usr/bin/env python3
"""
Generate cross-platform IotaPlayer icon assets from assets/icons/iotaplayer.svg.

Usage:
  uv run --with resvg-py --with pillow python scripts/generate-icons.py
"""

from __future__ import annotations

import io
import shutil
import struct
from pathlib import Path

import resvg_py
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MASTER_SVG = ROOT / "assets" / "icons" / "iotaplayer.svg"
WIN_ICO = ROOT / "assets" / "icons" / "win" / "icon.ico"
MAC_ICNS = ROOT / "assets" / "icons" / "mac" / "icon.icns"
LINUX_DIR = ROOT / "assets" / "icons" / "linux"
PUBLIC_FAVICON = ROOT / "public" / "favicon.svg"

WIN_SIZES = [16, 24, 32, 48, 64, 128, 256]
LINUX_SIZES = [16, 24, 32, 48, 64, 128, 256, 512]
# Standard Apple ICNS PNG-backed icon types
MAC_ICNS_ENTRIES: list[tuple[bytes, int]] = [
    (b"icp4", 16),
    (b"icp5", 32),
    (b"icp6", 64),
    (b"ic07", 128),
    (b"ic08", 256),
    (b"ic09", 512),
    (b"ic10", 1024),
]


def render_svg_to_image(svg_text: str, size: int) -> Image.Image:
    png_bytes = resvg_py.svg_to_bytes(
        svg_string=svg_text,
        width=size,
        height=size,
    )
    return Image.open(io.BytesIO(png_bytes)).convert("RGBA")


def build_windows_ico(svg_text: str, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Render from largest to smallest and save multi-resolution ICO
    images = [render_svg_to_image(svg_text, size) for size in reversed(WIN_SIZES)]
    images[0].save(
        out_path,
        format="ICO",
        sizes=[(s, s) for s in reversed(WIN_SIZES)],
        append_images=images[1:],
    )


def build_macos_icns(svg_text: str, out_path: Path) -> None:
    """
    Build an Apple .icns container with PNG-encoded representations.
    Applies ~10% transparent safe-area padding at 1024x1024 scale to match
    macOS icon grid proportions while keeping the master SVG untouched.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    chunks: list[bytes] = []

    for ostype, size in MAC_ICNS_ENTRIES:
        # Master SVG already has 32/512 (~6.25%) margin; scale to ~92% for macOS 10% optical grid
        inner_size = max(12, round(size * 0.92))
        rendered = render_svg_to_image(svg_text, inner_size)
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        offset = (size - inner_size) // 2
        canvas.paste(rendered, (offset, offset), rendered)

        buf = io.BytesIO()
        canvas.save(buf, format="PNG")
        png_data = buf.getvalue()
        chunk_len = 8 + len(png_data)
        chunks.append(ostype + struct.pack(">I", chunk_len) + png_data)

    body = b"".join(chunks)
    total_len = 8 + len(body)
    out_path.write_bytes(b"icns" + struct.pack(">I", total_len) + body)


def build_linux_assets(svg_text: str, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for size in LINUX_SIZES:
        img = render_svg_to_image(svg_text, size)
        img.save(out_dir / f"{size}x{size}.png", format="PNG")
    shutil.copyfile(MASTER_SVG, out_dir / "iotaplayer.svg")


def main() -> None:
    svg_text = MASTER_SVG.read_text(encoding="utf-8")

    # Keep public/favicon.svg synced with master SVG
    PUBLIC_FAVICON.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(MASTER_SVG, PUBLIC_FAVICON)

    build_windows_ico(svg_text, WIN_ICO)
    build_macos_icns(svg_text, MAC_ICNS)
    build_linux_assets(svg_text, LINUX_DIR)

    print(f"Generated Windows ICO : {WIN_ICO}")
    print(f"Generated macOS ICNS  : {MAC_ICNS}")
    print(f"Generated Linux PNGs  : {LINUX_DIR} ({len(LINUX_SIZES)} sizes + SVG)")


if __name__ == "__main__":
    main()
