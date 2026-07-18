import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const atlasDirectory = new URL("../../public/assets/characters/", import.meta.url);
const atlasNames = ["body.png", "hair-short.png", "hair-swept.png", "hair-curly.png"];
const width = 384;
const height = 224;
const cellSize = 32;

function readPngHeader(bytes: Buffer) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

async function readAtlas(name: string) {
  return readFile(new URL(name, atlasDirectory));
}

async function decodeAtlas(name: string) {
  const zlib = await import("node:zlib");
  const bytes = await readAtlas(name);
  let cursor = 8;
  const chunks: Buffer[] = [];
  while (cursor < bytes.length) {
    const size = bytes.readUInt32BE(cursor);
    const type = bytes.toString("ascii", cursor + 4, cursor + 8);
    if (type === "IDAT") chunks.push(bytes.subarray(cursor + 8, cursor + 8 + size));
    cursor += size + 12;
  }
  return zlib.inflateSync(Buffer.concat(chunks));
}

function cellPixels(scanlines: Buffer, cell: number) {
  const column = cell % 12;
  const row = Math.floor(cell / 12);
  const pixels: number[] = [];
  for (let y = row * cellSize; y < (row + 1) * cellSize; y++) {
    const start = y * (1 + width * 4) + 1 + column * cellSize * 4;
    for (let x = 0; x < cellSize * 4; x++) pixels.push(scanlines[start + x]);
  }
  return Buffer.from(pixels);
}

test("character atlases are 384 by 224 RGBA PNGs", async () => {
  for (const name of atlasNames) {
    const header = readPngHeader(await readAtlas(name));
    assert.deepEqual(header, { width, height, bitDepth: 8, colorType: 6 });
  }
});

test("character atlas reserve cells are transparent and used cells are populated", async () => {
  for (const name of atlasNames) {
    const scanlines = await decodeAtlas(name);
    for (let cell = 0; cell < 84; cell++) {
      const column = cell % 12;
      const row = Math.floor(cell / 12);
      let opaque = 0;
      for (let y = row * cellSize; y < (row + 1) * cellSize; y++) {
        const start = y * (1 + width * 4) + 1 + column * cellSize * 4;
        for (let x = 0; x < cellSize; x++) opaque += scanlines[start + x * 4 + 3] > 0 ? 1 : 0;
      }
      if (cell < 76) assert.ok(opaque > 0, `${name} cell ${cell} must contain pixels`);
      else assert.equal(opaque, 0, `${name} reserve cell ${cell} must be transparent`);
    }
  }
});

test("every body frame keeps its feet on local baseline 27", async () => {
  const scanlines = await decodeAtlas("body.png");
  for (let cell = 0; cell < 76; cell++) {
    const pixels = cellPixels(scanlines, cell);
    let lowerBound = -1;
    for (let y = 0; y < cellSize; y++) for (let x = 0; x < cellSize; x++) {
      if (pixels[(y * cellSize + x) * 4 + 3] > 0) lowerBound = y;
    }
    assert.equal(lowerBound, 27, `body cell ${cell} must end at local y=27`);
  }
});

test("walk directions use distinct rendered frame sequences", async () => {
  const scanlines = await decodeAtlas("body.png");
  const sequences = [8, 16, 24, 32].map((start) => Buffer.concat(
    Array.from({ length: 8 }, (_, offset) => cellPixels(scanlines, start + offset)),
  ));
  for (let index = 0; index < sequences.length; index++) {
    for (let other = index + 1; other < sequences.length; other++) {
      assert.notDeepEqual(sequences[index], sequences[other]);
    }
  }
});
