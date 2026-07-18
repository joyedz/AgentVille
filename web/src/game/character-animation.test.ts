import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  resolveCharacterAnimation,
  validateCharacterManifest,
} from "./character-animation.ts";

const manifestPath = new URL(
  "../../public/assets/characters/manifest.json",
  import.meta.url,
);

async function loadManifest() {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

test("accepts the shipped character animation manifest", async () => {
  const manifest = await loadManifest();

  assert.deepEqual(validateCharacterManifest(manifest), []);
});

test("rejects incorrect required animation metadata, atlas cells, and anchor", async () => {
  const validManifest = await loadManifest();
  const invalidManifests = [
    { mutate: (manifest: any) => { manifest.animations[0].start = 1; } },
    { mutate: (manifest: any) => { manifest.animations[0].fps = 6; } },
    { mutate: (manifest: any) => { manifest.animations[0].loop = false; } },
    { mutate: (manifest: any) => { manifest.cell.width = 16; } },
    { mutate: (manifest: any) => { manifest.cell.height = 16; } },
    { mutate: (manifest: any) => { manifest.anchor.x = 15; } },
    { mutate: (manifest: any) => { manifest.anchor.y = 27; } },
  ];

  for (const { mutate } of invalidManifests) {
    const manifest = structuredClone(validManifest);
    mutate(manifest);

    assert.notDeepEqual(validateCharacterManifest(manifest), []);
  }
});

test("resolves moving left to a looping walk-left animation", async () => {
  const manifest = await loadManifest();

  const resolved = resolveCharacterAnimation(manifest, "moving", "left");

  assert.equal(resolved.name, "walk-left");
  assert.equal(resolved.animation.loop, true);
});

test("falls back from an unknown state to looping idle", async () => {
  const manifest = await loadManifest();

  const resolved = resolveCharacterAnimation(manifest, "not-a-state", "down");

  assert.equal(resolved.name, "idle");
  assert.equal(resolved.animation.loop, true);
});

test("resolves completed to a non-looping celebrate animation", async () => {
  const manifest = await loadManifest();

  const resolved = resolveCharacterAnimation(manifest, "completed", "down");

  assert.equal(resolved.name, "celebrate");
  assert.equal(resolved.animation.loop, false);
});
