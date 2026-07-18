"""Build the deterministic 960x640 office background from the furniture PNG pack.

The build intentionally uses only the Python standard library so it can run in a
fresh checkout without Pillow/ImageMagick. PNGs in the source pack are RGBA, 8-bit,
non-interlaced files; the tiny decoder below supports the PNG filter modes used by
the pack and the encoder writes a standards-compliant RGBA PNG.
"""

from __future__ import annotations

import argparse
import struct
import zlib
from pathlib import Path

WIDTH, HEIGHT = 960, 640


def decode_png(path: Path) -> tuple[int, int, bytearray]:
    raw = path.read_bytes()
    if raw[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not a PNG: {path}")
    pos = 8
    width = height = bit_depth = color_type = None
    compressed = bytearray()
    while pos < len(raw):
        length = struct.unpack(">I", raw[pos : pos + 4])[0]
        kind = raw[pos + 4 : pos + 8]
        data = raw[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, bit_depth, color_type, comp, filt, interlace = struct.unpack(">IIBBBBB", data)
            if (bit_depth, color_type, comp, filt, interlace) != (8, 6, 0, 0, 0):
                raise ValueError(f"unsupported PNG format in {path}")
        elif kind == b"IDAT":
            compressed.extend(data)
        elif kind == b"IEND":
            break
    if width is None or height is None:
        raise ValueError(f"missing PNG header: {path}")
    decoded = zlib.decompress(compressed)
    stride = width * 4
    out = bytearray(height * stride)
    src = 0
    for y in range(height):
        mode = decoded[src]
        src += 1
        row = bytearray(decoded[src : src + stride])
        src += stride
        prior = out[(y - 1) * stride : y * stride] if y else bytearray(stride)
        for x in range(stride):
            left = row[x - 4] if x >= 4 else 0
            up = prior[x]
            up_left = prior[x - 4] if x >= 4 else 0
            if mode == 1:
                row[x] = (row[x] + left) & 255
            elif mode == 2:
                row[x] = (row[x] + up) & 255
            elif mode == 3:
                row[x] = (row[x] + ((left + up) // 2)) & 255
            elif mode == 4:
                p = left + up - up_left
                pa, pb, pc = abs(p - left), abs(p - up), abs(p - up_left)
                predictor = left if pa <= pb and pa <= pc else up if pb <= pc else up_left
                row[x] = (row[x] + predictor) & 255
            elif mode != 0:
                raise ValueError(f"unsupported PNG filter {mode} in {path}")
        out[y * stride : (y + 1) * stride] = row
    return width, height, out


def encode_png(path: Path, pixels: bytes, width: int = WIDTH, height: int = HEIGHT) -> None:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    scanlines = bytearray()
    stride = width * 4
    for y in range(height):
        scanlines.append(0)
        scanlines.extend(pixels[y * stride : (y + 1) * stride])
    payload = b"\x89PNG\r\n\x1a\n"
    payload += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    payload += chunk(b"IDAT", zlib.compress(bytes(scanlines), level=9))
    payload += chunk(b"IEND", b"")
    path.write_bytes(payload)


class Canvas:
    def __init__(self, width: int = WIDTH, height: int = HEIGHT) -> None:
        self.width, self.height = width, height
        self.pixels = bytearray(width * height * 4)

    def fill(self, color: tuple[int, int, int, int]) -> None:
        self.pixels[:] = bytes(color) * (self.width * self.height)

    def rect(self, x: int, y: int, w: int, h: int, color: tuple[int, int, int, int]) -> None:
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(self.width, x + w), min(self.height, y + h)
        if x1 <= x0 or y1 <= y0:
            return
        row = bytes(color) * (x1 - x0)
        for yy in range(y0, y1):
            start = (yy * self.width + x0) * 4
            self.pixels[start : start + len(row)] = row

    def sprite(self, image: tuple[int, int, bytearray], x: int, y: int, scale: int = 1) -> None:
        width, height, data = image
        for sy in range(height):
            for sx in range(width):
                i = (sy * width + sx) * 4
                alpha = data[i + 3]
                if not alpha:
                    continue
                for dy in range(scale):
                    yy = y + sy * scale + dy
                    if yy < 0 or yy >= self.height:
                        continue
                    for dx in range(scale):
                        xx = x + sx * scale + dx
                        if xx < 0 or xx >= self.width:
                            continue
                        di = (yy * self.width + xx) * 4
                        if alpha == 255:
                            self.pixels[di : di + 4] = data[i : i + 4]
                        else:
                            inv = 255 - alpha
                            self.pixels[di] = (data[i] * alpha + self.pixels[di] * inv) // 255
                            self.pixels[di + 1] = (data[i + 1] * alpha + self.pixels[di + 1] * inv) // 255
                            self.pixels[di + 2] = (data[i + 2] * alpha + self.pixels[di + 2] * inv) // 255
                            self.pixels[di + 3] = min(255, alpha + (self.pixels[di + 3] * inv) // 255)


def build(source: Path, output: Path) -> None:
    cache: dict[str, tuple[int, int, bytearray]] = {}

    def get(name: str) -> tuple[int, int, bytearray]:
        if name not in cache:
            cache[name] = decode_png(source / name)
        return cache[name]

    canvas = Canvas()
    # Warm pixel floor with a subtle checkerboard and a dark architectural frame.
    canvas.fill((27, 31, 48, 255))
    canvas.rect(18, 18, 924, 604, (245, 231, 183, 255))
    canvas.rect(18, 18, 924, 38, (50, 55, 76, 255))
    canvas.rect(18, 56, 924, 8, (123, 83, 77, 255))
    for y in range(64, 622, 32):
        for x in range(18, 942, 32):
            if ((x // 32) + (y // 32)) % 2 == 0:
                canvas.rect(x, y, 32, 32, (249, 237, 195, 255))
    # Room boundaries create distinct zones while leaving the agent floor open.
    canvas.rect(735, 64, 207, 184, (213, 194, 193, 255))
    canvas.rect(735, 64, 207, 8, (72, 50, 68, 255))
    canvas.rect(735, 240, 207, 8, (72, 50, 68, 255))
    canvas.rect(34, 376, 292, 226, (225, 204, 177, 255))
    canvas.rect(34, 376, 292, 8, (72, 50, 68, 255))
    canvas.rect(34, 594, 292, 8, (72, 50, 68, 255))
    canvas.rect(354, 376, 388, 226, (195, 211, 181, 255))
    canvas.rect(354, 376, 388, 8, (72, 50, 68, 255))
    canvas.rect(354, 594, 388, 8, (72, 50, 68, 255))

    # Central product desks: sprites sit above the agent feet and preserve a clear
    # 56x80 body footprint around the current desk positions (330/480/630 @ 250).
    for x in (284, 434, 584):
        canvas.sprite(get("Desk-2.png"), x, 180, 3)
        canvas.sprite(get("Chair.png"), x + 24, 276, 3)
    canvas.sprite(get("Small-Plant.png"), 220, 104, 3)
    canvas.sprite(get("Small-Plant.png"), 676, 104, 3)
    canvas.sprite(get("Wall-Graph.png"), 464, 82, 3)

    # Upper-right attention room.
    canvas.sprite(get("Board.png"), 760, 82, 5)
    canvas.sprite(get("Wall-Clock.png"), 888, 82, 4)
    canvas.sprite(get("Boss-Desk.png"), 780, 148, 3)
    canvas.sprite(get("Boss-Chair.png"), 826, 214, 3)
    canvas.sprite(get("Tall-Bookshelf.png"), 884, 142, 3)
    canvas.sprite(get("Wall-Note.png"), 754, 144, 3)

    # Lower-left coffee/reset room.
    canvas.sprite(get("Big-Sofa.png"), 58, 436, 3)
    canvas.sprite(get("Small-Table.png"), 148, 510, 4)
    canvas.sprite(get("Coffee-Machine.png"), 226, 408, 4)
    canvas.sprite(get("Water-Dispenser.png"), 268, 440, 3)
    canvas.sprite(get("Vending-Machine.png"), 52, 530, 2)
    canvas.sprite(get("Big-Plant.png"), 274, 530, 2)
    canvas.sprite(get("Wall-Shelf.png"), 210, 392, 3)

    # Lower-center lounge.
    canvas.sprite(get("Big-Sofa-2.png"), 392, 428, 3)
    canvas.sprite(get("Small-Sofa.png"), 576, 428, 3)
    canvas.sprite(get("Big-Round-Table.png"), 498, 514, 3)
    canvas.sprite(get("Bookshelf.png"), 690, 402, 4)
    canvas.sprite(get("Small-Plant.png"), 378, 548, 3)
    canvas.sprite(get("Small-Plant.png"), 688, 548, 3)
    canvas.sprite(get("Books.png"), 650, 548, 3)

    output.parent.mkdir(parents=True, exist_ok=True)
    encode_png(output, canvas.pixels)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("web/public/assets/office/furniture"))
    parser.add_argument("--output", type=Path, default=Path("web/public/assets/office/office-background-furniture.png"))
    args = parser.parse_args()
    build(args.source, args.output)
