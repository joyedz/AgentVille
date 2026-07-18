// @vitest-environment node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import {
  animationStateForStatus,
  directionForMovement,
  hairAtlasForRole,
  resolveCharacterAnimation,
  validateCharacterManifest,
} from "./character-animation.js";

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

test("rejects malformed animation entries", async () => {
  const manifest = structuredClone(await loadManifest());
  manifest.animations.push(null);

  assert.notDeepEqual(validateCharacterManifest(manifest), []);
});

test("rejects missing or invalid interaction-state mappings", async () => {
  const validManifest = await loadManifest();
  const invalidManifests = [
    { mutate: (manifest: any) => { delete manifest.stateMap; } },
    { mutate: (manifest: any) => { delete manifest.stateMap.working; } },
    { mutate: (manifest: any) => { manifest.stateMap.working = "missing-animation"; } },
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

test("maps agent roles to their intended hair overlays", () => {
  assert.equal(hairAtlasForRole("builder"), "hair-short");
  assert.equal(hairAtlasForRole("tester"), "hair-swept");
  assert.equal(hairAtlasForRole("documenter"), "hair-curly");
  assert.equal(hairAtlasForRole("other"), "hair-short");
});

test("maps agent statuses to the scene animation states", () => {
  assert.equal(animationStateForStatus("working"), "working");
  assert.equal(animationStateForStatus("idle"), "sitting");
  assert.equal(animationStateForStatus("blocked"), "talking");
  assert.equal(animationStateForStatus("error"), "talking");
  assert.equal(animationStateForStatus("paused"), "inactive");
  assert.equal(animationStateForStatus("stopped"), "inactive");
  assert.equal(animationStateForStatus("queued"), "waiting");
});

test("uses the dominant movement axis while retaining the last facing direction at rest", () => {
  assert.equal(directionForMovement({ x: 0, y: 0 }, { x: 12, y: 4 }, "left"), "right");
  assert.equal(directionForMovement({ x: 0, y: 0 }, { x: -12, y: 4 }, "right"), "left");
  assert.equal(directionForMovement({ x: 0, y: 0 }, { x: 4, y: -12 }, "down"), "up");
  assert.equal(directionForMovement({ x: 5, y: 5 }, { x: 5, y: 5 }, "left"), "left");
});
