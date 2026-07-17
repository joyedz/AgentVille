# AgentVille Pixel Office Asset Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Phaser map with a cozy top-down pixel-art office while preserving live agent selection, status overlays, and empty-desk assignment.

**Architecture:** Store original pixel-art assets under `web/public/assets/office/`. Phaser preloads one office background and transparent agent sprite sheets, then overlays live agent containers keyed by agent id. Existing React/server state contracts remain unchanged; only the visual scene and map styling change.

**Tech Stack:** React 19, Phaser 3.90, TypeScript, Vite, Vitest, generated PNG assets with nearest-neighbor rendering.

---

### Task 1: Establish the pixel asset contract and test fixtures

**Files:**
- Create: `web/public/assets/office/README.md`
- Create: `web/src/game/office-assets.ts`
- Create: `web/src/game/office-assets.test.ts`
- Modify: `web/src/game/positions.ts`
- Modify: `web/src/game/positions.test.ts`

- [ ] **Step 1: Write failing asset manifest tests.**

```ts
import { describe, expect, it } from 'vitest';
import { officeAssetManifest, officeCanvas } from './office-assets.js';

describe('office asset contract', () => {
  it('uses a fixed pixel-art canvas and stable asset URLs', () => {
    expect(officeCanvas).toEqual({ width: 960, height: 640 });
    expect(officeAssetManifest.background).toBe('/assets/office/office-background.png');
    expect(officeAssetManifest.agents.builder).toBe('/assets/office/agent-builder.png');
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `npm test -- --run web/src/game/office-assets.test.ts`

Expected: FAIL because the manifest module does not exist.

- [ ] **Step 3: Add the manifest and pixel-safe position contract.**

```ts
export const officeCanvas = { width: 960, height: 640 } as const;

export const officeAssetManifest = {
  background: '/assets/office/office-background.png',
  agents: {
    builder: '/assets/office/agent-builder.png',
    tester: '/assets/office/agent-tester.png',
    documenter: '/assets/office/agent-documenter.png'
  }
} as const;
```

Update `positions.ts` to use seats inside the new 960×640 office: desk `{ x: 330, y: 250 }`, `{ x: 480, y: 250 }`, `{ x: 630, y: 250 }`; coffee `{ x: 150, y: 500 }`, `{ x: 245, y: 500 }`; lounge `{ x: 520, y: 500 }`, `{ x: 650, y: 500 }`; attention `{ x: 825, y: 155 }`, `{ x: 890, y: 155 }`.

- [ ] **Step 4: Add asset provenance notes.**

`web/public/assets/office/README.md` must state that files are original/generated for AgentVille, use nearest-neighbor scaling, and are not copied from the supplied reference.

- [ ] **Step 5: Run focused tests and commit.**

Run: `npm test -- --run web/src/game/office-assets.test.ts web/src/game/positions.test.ts`

Expected: PASS.

```bash
git add web/public/assets/office/README.md web/src/game/office-assets.ts web/src/game/office-assets.test.ts web/src/game/positions.ts web/src/game/positions.test.ts
git commit -m "feat: define pixel office asset contract"
```

### Task 2: Generate the original pixel-art asset pack

**Files:**
- Create: `web/public/assets/office/office-background.png`
- Create: `web/public/assets/office/agent-builder.png`
- Create: `web/public/assets/office/agent-tester.png`
- Create: `web/public/assets/office/agent-documenter.png`
- Create: `web/public/assets/office/status-markers.png`
- Create: `web/public/assets/office/office-props.png`
- Create: `web/public/assets/office/nameplates.png`

- [ ] **Step 1: Read the image-generation skill and use it for original bitmap assets.**

Use the supplied image only as visual direction: top-down pixel office, warm cream floor, lavender/blue rooms, dense desks and plants, dark rounded nameplates. Do not reproduce its characters, labels, logos, or exact layout.

- [ ] **Step 2: Generate the office background.**

Generate a 960×640 top-down pixel-art office with four readable zones: central product-team desks, lower-left coffee/reset room, lower-center lounge, and upper-right attention room. Leave clear 64×64 pixel spaces around the agent seat coordinates. Keep the background free of text and characters.

- [ ] **Step 3: Generate three transparent agent sprites.**

Generate three 32×48 pixel-art character sheets with four horizontal frames: idle, working, blocked, paused. Make Builder, Tester, and Documenter visually distinct by silhouette/accent color only; do not include text.

- [ ] **Step 4: Generate status markers and verify dimensions.**

Create a small transparent marker sheet for working glow, amber blocked alert, violet paused badge, and red error badge. Verify all files decode locally and use nearest-neighbor-friendly dimensions before committing.

- [ ] **Step 5: Generate reusable prop and nameplate sheets.**

Generate a compact transparent prop sheet containing desk monitors, coffee machine, lounge plants, shelving, and attention-room accents, plus a pixel nameplate sheet with empty, working, blocked, paused, and error treatments. Keep these sheets decorative: live text remains Phaser text so names and statuses stay accessible and data-driven.

- [ ] **Step 6: Commit only the reviewed asset files.**

```bash
git add web/public/assets/office
git commit -m "feat: add pixel office asset pack"
```

### Task 3: Render the pixel office background in Phaser

**Files:**
- Modify: `web/src/game/OfficeScene.ts`
- Create: `web/src/game/OfficeScene.test.ts`

- [ ] **Step 1: Add a scene test seam.**

Mock Phaser's `Game`, `Scene`, and loader in the test so the test can assert that `OfficeScene.preload()` calls `this.load.image('office-background', officeAssetManifest.background)` and that `create()` adds the image at the canvas center without requiring a real browser canvas.

- [ ] **Step 2: Run the focused scene test and verify it fails.**

Run: `npm test -- --run web/src/game/OfficeScene.test.ts`

Expected: FAIL because `preload()` and the background image layer do not exist.

- [ ] **Step 3: Implement preload and background rendering.**

Add `preload()` to load the manifest assets, set `this.textures`/renderer smoothing off where supported, and add the background image at `(officeCanvas.width / 2, officeCanvas.height / 2)` with origin `0.5`. Keep the existing callback constructor and empty-desk hit area.

- [ ] **Step 4: Update Phaser dimensions and responsive CSS.**

Use the manifest canvas size in `createOfficeGame`, preserve `Phaser.Scale.FIT`, set `pixelArt: true`, and update `.office-map` to use a 3:2 aspect ratio with `image-rendering: pixelated` on the canvas.

- [ ] **Step 5: Run focused tests and commit.**

Run: `npm test -- --run web/src/game/OfficeScene.test.ts web/src/game/positions.test.ts`

Expected: PASS.

```bash
git add web/src/game/OfficeScene.ts web/src/game/OfficeScene.test.ts web/src/styles.css
git commit -m "feat: render pixel office background"
```

### Task 4: Replace circular agents with pixel sprites and status overlays

**Files:**
- Modify: `web/src/game/OfficeScene.ts`
- Modify: `web/src/game/OfficeScene.test.ts`
- Modify: `web/src/App.test.tsx`

- [ ] **Step 1: Add failing overlay behavior tests.**

Assert that a new agent view creates a sprite using the role-specific texture, renders a nameplate text object, and updates the status marker when `updateAgents()` receives `blocked`, `paused`, or `error`.

- [ ] **Step 2: Run the focused tests and verify they fail.**

Run: `npm test -- --run web/src/game/OfficeScene.test.ts web/src/App.test.tsx`

Expected: FAIL because agent views currently use colored circles and do not load textures or status markers.

- [ ] **Step 3: Implement role-aware sprite views.**

Extend `OfficeAgent` with optional `role` and `checkpoint`, map roles to manifest textures, create a sprite with `setOrigin(0.5, 1)`, add a rounded dark nameplate with status glyph, and update the sprite frame/marker color on each state update. Keep `container.on('pointerup', () => onAgentSelected(agent.id))` and the existing desk hit area.

- [ ] **Step 4: Add selected-agent emphasis without changing selection state.**

Add an optional `setSelectedAgent(agentId: string | null)` scene method. App calls it whenever `selectedId` changes; the selected container gets a mint outline/glow and other containers return to their normal frame.

- [ ] **Step 5: Run all web tests and commit.**

Run: `npm test -- --run web`

Expected: PASS.

```bash
git add web/src/game/OfficeScene.ts web/src/game/OfficeScene.test.ts web/src/App.tsx web/src/App.test.tsx
git commit -m "feat: add pixel agent sprites and status overlays"
```

### Task 5: Polish map framing, accessibility copy, and verification

**Files:**
- Modify: `web/src/styles.css`
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.test.tsx`
- Modify: `README.md`

- [ ] **Step 1: Add map framing and accessible room summary.**

Keep the Phaser canvas decorative but add a visually hidden map summary next to it: `Agentville office map with Product desks, Coffee reset room, Lounge, and Attention room. Select an agent on the map or use the inspector.` Ensure the existing map hint and empty-desk notice remain visible.

- [ ] **Step 2: Verify responsive behavior.**

Use CSS `image-rendering: pixelated`, a 3:2 map aspect ratio, `min-height: 360px`, and the existing single-column breakpoint. Confirm the inspector remains usable below 850px.

- [ ] **Step 3: Add regression assertions.**

Assert the accessible room summary is present in `App.test.tsx`, and retain existing agent selection, empty-desk assignment, command feedback, and malformed-snapshot tests unchanged.

- [ ] **Step 4: Run the complete verification suite.**

Run: `npm test -- --run && npm run build`

Expected: all existing tests plus the new scene/asset tests pass; TypeScript and Vite build succeed. A large Phaser chunk warning is acceptable if no runtime/build error occurs.

- [ ] **Step 5: Commit and document the visual refresh.**

```bash
git add web/src/styles.css web/src/App.tsx web/src/App.test.tsx README.md
git commit -m "feat: polish pixel office presentation"
```
