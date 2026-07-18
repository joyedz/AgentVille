"""Render the eight-frame transparent AgentVille role sheets.

The first four frames are the status poses already stored in each role sheet and
are copied without alteration.  Frames 4--7 are generated from the idle pose
using the explicit pixel-art walk-pose instructions below.  This keeps the
status artwork intact while making the editable walk authoring process local,
deterministic, and dependency-free.

Run from the repository root:
    python tools/build-agent-sheets.py

The script accepts either the legacy 192x72 sheets or the generated 384x72
sheets (only their first four frames are used as source), so it is safe to rerun.
It writes non-interlaced, 8-bit RGBA PNGs.
"""

from __future__ import annotations

import argparse
import struct
import zlib
from pathlib import Path

FRAME_WIDTH = 48
FRAME_HEIGHT = 72
STATUS_FRAME_COUNT = 4
WALK_FRAME_COUNT = 4
SHEET_WIDTH = FRAME_WIDTH * (STATUS_FRAME_COUNT + WALK_FRAME_COUNT)
ROLE_ACCENTS = {
    "agent-builder.png": (45, 124, 235, 255),
    "agent-tester.png": (217, 119, 6, 255),
    "agent-documenter.png": (124, 58, 237, 255),
}
OUTLINE = (51, 65, 85, 255)


def decode_rgba_png(path: Path) -> tuple[int, int, bytearray]:
    """Decode the standard RGBA PNGs used by the local role artwork."""
    raw = path.read_bytes()
    if raw[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not a PNG: {path}")
    position = 8
    width = height = None
    compressed = bytearray()
    while position < len(raw):
        length = struct.unpack(">I", raw[position : position + 4])[0]
        kind = raw[position + 4 : position + 8]
        data = raw[position + 8 : position + 8 + length]
        position += 12 + length
        if kind == b"IHDR":
            width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", data)
            if (depth, color, compression, filtering, interlace) != (8, 6, 0, 0, 0):
                raise ValueError(f"expected 8-bit RGBA PNG: {path}")
        elif kind == b"IDAT":
            compressed.extend(data)
        elif kind == b"IEND":
            break
    if width is None or height is None:
        raise ValueError(f"missing PNG header: {path}")

    decoded = zlib.decompress(compressed)
    stride = width * 4
    output = bytearray(height * stride)
    source = 0
    for y in range(height):
        mode = decoded[source]
        source += 1
        row = bytearray(decoded[source : source + stride])
        source += stride
        previous = output[(y - 1) * stride : y * stride] if y else bytearray(stride)
        for x in range(stride):
            left = row[x - 4] if x >= 4 else 0
            up = previous[x]
            up_left = previous[x - 4] if x >= 4 else 0
            if mode == 1:
                row[x] = (row[x] + left) & 255
            elif mode == 2:
                row[x] = (row[x] + up) & 255
            elif mode == 3:
                row[x] = (row[x] + ((left + up) // 2)) & 255
            elif mode == 4:
                predictor = left + up - up_left
                distances = (abs(predictor - left), abs(predictor - up), abs(predictor - up_left))
                row[x] = (row[x] + (left if distances[0] <= distances[1] and distances[0] <= distances[2] else up if distances[1] <= distances[2] else up_left)) & 255
            elif mode != 0:
                raise ValueError(f"unsupported PNG filter {mode} in {path}")
        output[y * stride : (y + 1) * stride] = row
    return width, height, output


def encode_rgba_png(path: Path, pixels: bytes, width: int, height: int) -> None:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    scanlines = bytearray()
    stride = width * 4
    for y in range(height):
        scanlines.append(0)
        scanlines.extend(pixels[y * stride : (y + 1) * stride])
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(scanlines), level=9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def set_pixel(pixels: bytearray, x: int, y: int, color: tuple[int, int, int, int]) -> None:
    if 0 <= x < FRAME_WIDTH and 0 <= y < FRAME_HEIGHT:
        index = (y * FRAME_WIDTH + x) * 4
        pixels[index : index + 4] = bytes(color)


def pixel_line(pixels: bytearray, start: tuple[int, int], end: tuple[int, int], color: tuple[int, int, int, int], width: int = 2) -> None:
    """Draw a deliberately chunky line for a readable 48px pixel-art limb."""
    x0, y0 = start
    x1, y1 = end
    steps = max(abs(x1 - x0), abs(y1 - y0), 1)
    for step in range(steps + 1):
        x = round(x0 + (x1 - x0) * step / steps)
        y = round(y0 + (y1 - y0) * step / steps)
        for dx in range(-(width // 2), width - width // 2):
            for dy in range(-(width // 2), width - width // 2):
                set_pixel(pixels, x + dx, y + dy, color)


def copy_idle_with_shift(source: bytearray, source_width: int, shift_x: int, shift_y: int) -> bytearray:
    frame = bytearray(FRAME_WIDTH * FRAME_HEIGHT * 4)
    for y in range(FRAME_HEIGHT):
        for x in range(FRAME_WIDTH):
            sx, sy = x - shift_x, y - shift_y
            if not (0 <= sx < FRAME_WIDTH and 0 <= sy < FRAME_HEIGHT):
                continue
            source_index = (sy * source_width + sx) * 4
            target_index = (y * FRAME_WIDTH + x) * 4
            frame[target_index : target_index + 4] = source[source_index : source_index + 4]
    return frame


def draw_walk_pose(source: bytearray, source_width: int, pose: int, accent: tuple[int, int, int, int]) -> bytearray:
    """Author the contact, passing, stride, and passing poses over the idle art."""
    torso_offsets = ((-1, 0), (0, -1), (1, 0), (0, -1))
    leg_targets = (((17, 66), (30, 62)), ((21, 63), (27, 65)), ((30, 66), (17, 62)), ((27, 65), (21, 63)))
    arm_targets = (((13, 43), (34, 39)), ((16, 39), (31, 43)), ((16, 43), (35, 39)), ((13, 39), (32, 43)))
    shift_x, shift_y = torso_offsets[pose]
    frame = copy_idle_with_shift(source, source_width, shift_x, shift_y)

    # A 5px accent sash keeps the role color visible even where the idle art is muted.
    for y in range(38 + shift_y, 44 + shift_y):
        for x in range(21 + shift_x, 26 + shift_x):
            set_pixel(frame, x, y, accent)

    # Alternating outlined legs and counter-swinging arms make each silhouette distinct.
    for endpoint in leg_targets[pose]:
        pixel_line(frame, (23 + shift_x, 50 + shift_y), endpoint, OUTLINE, 4)
        pixel_line(frame, (23 + shift_x, 50 + shift_y), endpoint, accent, 2)
    for endpoint in arm_targets[pose]:
        pixel_line(frame, (22 + shift_x if endpoint[0] < 24 else 27 + shift_x, 34 + shift_y), endpoint, OUTLINE, 3)
        pixel_line(frame, (22 + shift_x if endpoint[0] < 24 else 27 + shift_x, 34 + shift_y), endpoint, accent, 1)
    return frame


def render_sheet(path: Path, accent: tuple[int, int, int, int]) -> None:
    width, height, source = decode_rgba_png(path)
    if height != FRAME_HEIGHT or width < FRAME_WIDTH * STATUS_FRAME_COUNT:
        raise ValueError(f"expected at least four 48x72 frames: {path}")
    output = bytearray(SHEET_WIDTH * FRAME_HEIGHT * 4)
    for frame in range(STATUS_FRAME_COUNT):
        for y in range(FRAME_HEIGHT):
            source_start = (y * width + frame * FRAME_WIDTH) * 4
            target_start = (y * SHEET_WIDTH + frame * FRAME_WIDTH) * 4
            output[target_start : target_start + FRAME_WIDTH * 4] = source[source_start : source_start + FRAME_WIDTH * 4]
    for pose in range(WALK_FRAME_COUNT):
        walk = draw_walk_pose(source, width, pose, accent)
        for y in range(FRAME_HEIGHT):
            target_start = (y * SHEET_WIDTH + (STATUS_FRAME_COUNT + pose) * FRAME_WIDTH) * 4
            source_start = y * FRAME_WIDTH * 4
            output[target_start : target_start + FRAME_WIDTH * 4] = walk[source_start : source_start + FRAME_WIDTH * 4]
    encode_rgba_png(path, output, SHEET_WIDTH, FRAME_HEIGHT)


def main() -> None:
    parser = argparse.ArgumentParser(description="Render eight-frame transparent AgentVille role sheets.")
    parser.add_argument("--asset-dir", type=Path, default=Path("web/public/assets/office"))
    args = parser.parse_args()
    for filename, accent in ROLE_ACCENTS.items():
        render_sheet(args.asset_dir / filename, accent)


if __name__ == "__main__":
    main()
