import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const atlasDirectory = new URL("../../public/assets/characters/", import.meta.url);
const manifestPath = new URL("../../public/assets/characters/manifest.json", import.meta.url);
const generatorPath = new URL("../../../scripts/generate-character-atlases.mjs", import.meta.url);
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

async function loadManifest() {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

function usedFrames(manifest: any) {
  return new Set(manifest.animations.flatMap((animation: any) =>
    Array.from({ length: animation.frames }, (_, offset) => animation.start + offset),
  ));
}

function cellOpacity(scanlines: Buffer, cell: number) {
  const pixels = cellPixels(scanlines, cell);
  let opaque = 0;
  for (let offset = 3; offset < pixels.length; offset += 4) opaque += pixels[offset] > 0 ? 1 : 0;
  return opaque;
}

function assertAtlasCoverage(scanlines: Buffer, manifest: any, name: string) {
  const capacity = manifest.cell.columns * manifest.cell.rows;
  const frames = usedFrames(manifest);
  for (let cell = 0; cell < capacity; cell++) {
    if (frames.has(cell)) assert.ok(cellOpacity(scanlines, cell) > 0, `${name} frame ${cell} must contain pixels`);
    else assert.equal(cellOpacity(scanlines, cell), 0, `${name} non-frame cell ${cell} must be transparent`);
  }
}

function largestSkinComponent(pixels: Buffer) {
  const skin = (x: number, y: number) => {
    const offset = (y * cellSize + x) * 4;
    return pixels[offset] === 235 && pixels[offset + 1] === 181 && pixels[offset + 2] === 142 && pixels[offset + 3] > 0;
  };
  const seen = new Set<string>();
  const components: Array<Array<[number, number]>> = [];
  for (let y = 0; y < cellSize; y++) for (let x = 0; x < cellSize; x++) {
    const key = `${x},${y}`;
    if (!skin(x, y) || seen.has(key)) continue;
    const component: Array<[number, number]> = [];
    const queue: Array<[number, number]> = [[x, y]];
    seen.add(key);
    while (queue.length) {
      const [currentX, currentY] = queue.pop()!;
      component.push([currentX, currentY]);
      for (const [nextX, nextY] of [[currentX - 1, currentY], [currentX + 1, currentY], [currentX, currentY - 1], [currentX, currentY + 1]]) {
        const nextKey = `${nextX},${nextY}`;
        if (nextX >= 0 && nextY >= 0 && nextX < cellSize && nextY < cellSize && skin(nextX, nextY) && !seen.has(nextKey)) {
          seen.add(nextKey); queue.push([nextX, nextY]);
        }
      }
    }
    components.push(component);
  }
  const head = components.sort((left, right) => right.length - left.length)[0];
  return { minX: Math.min(...head.map(([x]) => x)), maxX: Math.max(...head.map(([x]) => x)), minY: Math.min(...head.map(([, y]) => y)) };
}

function opaqueBounds(pixels: Buffer) {
  const points: Array<[number, number]> = [];
  for (let y = 0; y < cellSize; y++) for (let x = 0; x < cellSize; x++) if (pixels[(y * cellSize + x) * 4 + 3] > 0) points.push([x, y]);
  return { minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)), minY: Math.min(...points.map(([, y]) => y)) };
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
  const manifest = await loadManifest();
  for (const name of atlasNames) {
    const scanlines = await decodeAtlas(name);
    assertAtlasCoverage(scanlines, manifest, name);
  }
});

test("atlas coverage detects a manifest frame range mismatch", async () => {
  const manifest = structuredClone(await loadManifest());
  manifest.animations.find((animation: any) => animation.name === "talk").frames = 3;
  const scanlines = await decodeAtlas("body.png");

  assert.throws(() => assertAtlasCoverage(scanlines, manifest, "body.png"));
});

test("renderer derives populated frame coverage from the manifest", async () => {
  const renderer = await readFile(generatorPath, "utf8");

  assert.match(renderer, /readFileSync\(new URL\("\.\.\/web\/public\/assets\/characters\/manifest\.json"/);
  assert.doesNotMatch(renderer, /frame < 76/);
});

test("renderer pose dispatch follows remapped manifest animation ranges", async () => {
  const { poseForFrame } = await import(generatorPath.href);
  const remapped = structuredClone(await loadManifest());
  const idle = remapped.animations.find((animation: any) => animation.name === "idle");
  const walkUp = remapped.animations.find((animation: any) => animation.name === "walk-up");
  [idle.start, walkUp.start] = [walkUp.start, idle.start];

  assert.equal(poseForFrame(0, remapped).direction, "up");
  assert.equal(poseForFrame(8, remapped).direction, undefined);
});

test("every body frame keeps its feet on local baseline 27", async () => {
  const scanlines = await decodeAtlas("body.png");
  for (const cell of usedFrames(await loadManifest())) {
    const pixels = cellPixels(scanlines, cell);
    let lowerBound = -1;
    for (let y = 0; y < cellSize; y++) for (let x = 0; x < cellSize; x++) {
      if (pixels[(y * cellSize + x) * 4 + 3] > 0) lowerBound = y;
    }
    assert.equal(lowerBound, 27, `body cell ${cell} must end at local y=27`);
  }
});

test("each hair overlay is registered around its body's head in every manifest frame", async () => {
  const body = await decodeAtlas("body.png");
  const hairAtlases = await Promise.all(atlasNames.slice(1).map(decodeAtlas));
  for (const frame of usedFrames(await loadManifest())) {
    const head = largestSkinComponent(cellPixels(body, frame));
    for (const hair of hairAtlases) {
      const bounds = opaqueBounds(cellPixels(hair, frame));
      assert.equal(bounds.minY, head.minY - 1, `hair frame ${frame} must start one pixel above the head`);
      assert.ok(bounds.minX <= head.minX && bounds.maxX >= head.maxX, `hair frame ${frame} must span the head`);
    }
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
