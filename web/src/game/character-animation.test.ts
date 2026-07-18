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
