import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const WIDTH = 384;
const HEIGHT = 224;
const CELL = 32;
const OUTPUT = new URL("../web/public/assets/characters/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("../web/public/assets/characters/manifest.json", import.meta.url), "utf8"));
const usedFrames = new Set(manifest.animations.flatMap((animation) =>
  Array.from({ length: animation.frames }, (_, offset) => animation.start + offset),
));
const PALETTE = {
  navy: [30, 53, 80, 255], ink: [17, 31, 47, 255], mint: [99, 214, 182, 255],
  skin: [235, 181, 142, 255], skinShade: [203, 137, 108, 255], shoe: [24, 35, 49, 255],
  short: [73, 49, 43, 255], swept: [51, 68, 91, 255], curly: [93, 59, 42, 255],
};

function canvas() { return new Uint8Array(WIDTH * HEIGHT * 4); }
function px(data, x, y, color) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  data.set(color, (y * WIDTH + x) * 4);
}
function rect(data, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(data, xx, yy, color);
}
function shape(data, ox, oy, rows, color) {
  rows.forEach((row, y) => [...row].forEach((on, x) => { if (on !== ".") px(data, ox + x, oy + y, color); }));
}
export function poseForFrame(frame, animationManifest = manifest) {
  const animation = animationManifest.animations.find((candidate) => frame >= candidate.start && frame < candidate.start + candidate.frames);
  if (!animation) throw new Error(`No manifest animation covers frame ${frame}.`);
  const phase = frame - animation.start;
  if (animation.name === "idle") return { bob: phase % 4 === 2 ? 1 : 0, arms: phase % 4 === 1 ? 1 : 0, legs: [0, 0] };
  if (animation.name.startsWith("walk-")) return { direction: animation.name.slice(5), bob: phase === 1 || phase === 5 ? 1 : 0, arms: phase < 4 ? -2 : 2, legs: phase < 2 ? [-2, 2] : phase < 4 ? [0, 0] : phase < 6 ? [2, -2] : [0, 0] };
  if (animation.name === "sit") return { bob: 2, arms: 0, legs: [2, 2], sit: true };
  if (animation.name === "typing") return { bob: 1, arms: phase % 2 ? 3 : 1, legs: [1, -1], typing: true };
  if (animation.name === "thinking") return { bob: phase % 4 === 2 ? 0 : 1, arms: phase % 4 === 1 ? -4 : 2, legs: [0, 0], think: true };
  if (animation.name === "celebrate") return { bob: phase === 0 || phase === animation.frames - 1 ? 1 : 0, arms: [-2, -5, -8, -8, -5, -2][phase], legs: [0, 0], celebrate: true };
  if (animation.name === "wave") return { bob: 0, arms: [-2, -7, -10, -4][phase], legs: [0, 0], wave: true };
  if (animation.name === "sleep") return { bob: 3, arms: 1, legs: [2, 2], sleep: true };
  if (animation.name === "talk") return { bob: 0, arms: phase % 2 ? 2 : -1, legs: [0, 0], talk: true };
  throw new Error(`No pose is defined for manifest animation ${animation.name}.`);
}
function drawBody(data, frame) {
  const cellX = (frame % 12) * CELL;
  const cellY = Math.floor(frame / 12) * CELL;
  const p = poseForFrame(frame); const x = cellX + 8; const y = cellY + p.bob;
  // Head deliberately excludes hair, which is supplied by overlay atlases.
  shape(data, x + 6, y + 1, [".SSSS.", "SSSSSS", "SSSSSS", "SSSSSS", ".SSSS."], PALETTE.skin);
  if (p.direction === "up") rect(data, x + 8, y + 5, 4, 2, PALETTE.skinShade);
  else if (p.direction === "left") { rect(data, x + 7, y + 5, 1, 1, PALETTE.ink); rect(data, x + 6, y + 7, 1, 1, PALETTE.skinShade); }
  else if (p.direction === "right") { rect(data, x + 12, y + 5, 1, 1, PALETTE.ink); rect(data, x + 13, y + 7, 1, 1, PALETTE.skinShade); }
  else { rect(data, x + 7, y + 5, 1, 1, PALETTE.ink); rect(data, x + 11, y + 5, 1, 1, PALETTE.ink); }
  if (p.talk && frame % 4 > 1) rect(data, x + 9, y + 8, 2, 1, PALETTE.skinShade);
  rect(data, x + 8, y + 10, 4, 2, PALETTE.skinShade);
  const torsoY = y + (p.sit ? 15 : 12);
  rect(data, x + 5, torsoY, 10, 9, PALETTE.navy); rect(data, x + 9, torsoY, 2, 8, PALETTE.mint);
  const armY = torsoY + 2;
  if (p.celebrate || p.wave) {
    rect(data, x + 3, armY + p.arms, 2, 6, PALETTE.navy); rect(data, x + 2, armY + p.arms - 1, 2, 2, PALETTE.skin);
    rect(data, x + 15, armY + p.arms, 2, 6, PALETTE.navy); rect(data, x + 15, armY + p.arms - 1, 2, 2, PALETTE.skin);
  } else if (p.think) {
    rect(data, x + 14, armY - 3, 2, 6, PALETTE.navy); rect(data, x + 14, armY - 4, 2, 2, PALETTE.skin);
    rect(data, x + 3, armY + 1, 2, 5, PALETTE.navy);
  } else {
    rect(data, x + 3, armY + p.arms, 2, 6, PALETTE.navy); rect(data, x + 2, armY + p.arms + 5, 2, 2, PALETTE.skin);
    rect(data, x + 15, armY - p.arms, 2, 6, PALETTE.navy); rect(data, x + 15, armY - p.arms + 5, 2, 2, PALETTE.skin);
  }
  if (p.typing) { rect(data, x + 3, y + 20, 5, 1, PALETTE.skin); rect(data, x + 12, y + 20, 5, 1, PALETTE.skin); }
  const legY = p.sit ? y + 22 : y + 21;
  const legHeight = Math.max(1, Math.min(p.sit ? 4 : 6, cellY + 27 - legY));
  rect(data, x + 6 + p.legs[0], legY, 3, legHeight, PALETTE.navy);
  rect(data, x + 11 + p.legs[1], legY, 3, legHeight, PALETTE.navy);
  rect(data, x + 5 + p.legs[0], cellY + 27, 5, 1, PALETTE.shoe); rect(data, x + 10 + p.legs[1], cellY + 27, 5, 1, PALETTE.shoe);
  if (p.sleep) { rect(data, x + 15, y + 2, 2, 1, PALETTE.mint); rect(data, x + 17, y, 2, 1, PALETTE.mint); }
}
function drawHair(data, frame, style) {
  const cellX = (frame % 12) * CELL; const cellY = Math.floor(frame / 12) * CELL; const p = poseForFrame(frame);
  const x = cellX + 8; const y = cellY + p.bob; const color = PALETTE[style];
  if (style === "short") shape(data, x + 5, y, [".HHHHHH.", "HHHHHHHH", "HH....HH", "H......H"], color);
  if (style === "swept") shape(data, x + 4, y, ["..HHHHH.", ".HHHHHHH", "HHHH...H", "H......H", "......HH"], color);
  if (style === "curly") shape(data, x + 4, y, [".H.H.H.H", "HHHHHHHH", "HH....HH", "H......H", ".H....H."], color);
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const value of data) { crc ^= value; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function png(data) {
  const scanlines = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) { scanlines[y * (WIDTH * 4 + 1)] = 0; Buffer.from(data).copy(scanlines, y * (WIDTH * 4 + 1) + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(WIDTH, 0); ihdr.writeUInt32BE(HEIGHT, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(scanlines)), chunk("IEND", Buffer.alloc(0))]);
}
function write(name, draw) { const data = canvas(); for (const frame of usedFrames) draw(data, frame); writeFileSync(new URL(name, OUTPUT), png(data)); }

export function generateAtlases() {
  mkdirSync(OUTPUT, { recursive: true });
  write("body.png", drawBody);
  write("hair-short.png", (data, frame) => drawHair(data, frame, "short"));
  write("hair-swept.png", (data, frame) => drawHair(data, frame, "swept"));
  write("hair-curly.png", (data, frame) => drawHair(data, frame, "curly"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) generateAtlases();
