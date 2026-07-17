# Agent Scale and Walk Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make office agents visibly larger and animate a short walk cycle while they move between zones.

**Architecture:** Keep the existing Phaser `OfficeScene` as the owner of agent views, status frames, movement tweens, and cleanup. Add shared layout/motion constants to `office-assets.ts`, and use Phaser's timer/tween callbacks for temporary walk frames so stationary agents retain their status pose. Extend the scene tests with mocked scale, timer, and tween completion behavior.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Vite.

---

### Task 1: Add explicit agent presentation and motion contracts

**Files:**
- Modify: `web/src/game/office-assets.ts`
- Test: `web/src/game/office-assets.test.ts`

- [ ] **Step 1: Write the failing contract test**

Add assertions for an exported presentation contract:

```ts
expect(agentPresentation).toEqual({
  scale: 1.5,
  frameDurationMs: 140,
  frameWidth: 48,
  frameHeight: 72,
  walkFrames: [0, 1]
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run `npm test -- --run web/src/game/office-assets.test.ts` from `web/`.
Expected: FAIL because `agentPresentation` is not exported yet.

- [ ] **Step 3: Implement the minimal contract**

Export the immutable `agentPresentation` object from `web/src/game/office-assets.ts` with the exact values above. Keep `agentSprite` unchanged because the source sheets remain 48x72 frames.

- [ ] **Step 4: Run the focused test and verify it passes**

Run `npm test -- --run web/src/game/office-assets.test.ts`.
Expected: the office asset contract tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/game/office-assets.ts web/src/game/office-assets.test.ts
git commit -m "feat: define agent presentation motion contract"
```

### Task 2: Scale agents and add walk-cycle lifecycle

**Files:**
- Modify: `web/src/game/OfficeScene.ts`
- Test: `web/src/game/OfficeScene.test.ts`

- [ ] **Step 1: Write failing scene tests**

Extend the Phaser mock sprite with `setScale`, add a mock `scene.time.addEvent`, and add tests that assert:

```ts
expect(sprite.setScale).toHaveBeenCalledWith(1.5);
expect(scene.add.rectangle).toHaveBeenCalledWith(0, -54, 84, 116);
expect(container.setSize).toHaveBeenCalledWith(96, 148);
```

For motion, create an agent, update it into a different zone, and assert `scene.time.addEvent` receives `{ delay: 140, loop: true, callback: expect.any(Function) }`. Invoke the tween's `onComplete` callback and assert the timer's `remove` method and the status frame setter were called.

- [ ] **Step 2: Run the focused scene test and verify it fails**

Run `npm test -- --run web/src/game/OfficeScene.test.ts` from `web/`.
Expected: FAIL because the scene still renders at 1x and does not create a walk timer.

- [ ] **Step 3: Implement scaled rendering**

In `OfficeScene.ts`, import `agentPresentation`. On sprite creation call `.setScale(agentPresentation.scale)`. Increase the outline to 84x116 centered at y=-54, move the name/status text above the scaled head, and set the interactive container to 96x148. Keep zone coordinates and callbacks unchanged.

- [ ] **Step 4: Implement walk start and completion**

Track each view's current target, walk timer, and walk-frame index. Only start movement when the target coordinates change. Add a `startWalk` helper that sets the first walk frame and uses `this.time.addEvent` with the contract delay/loop to alternate `agentPresentation.walkFrames`. Add a completion callback to remove the timer, clear motion state, and restore the status frame. Remove any active timer when an agent view is destroyed.

- [ ] **Step 5: Run the focused scene tests and verify they pass**

Run `npm test -- --run web/src/game/OfficeScene.test.ts`.
Expected: all scene tests pass, including scale and walk lifecycle assertions.

- [ ] **Step 6: Commit**

```bash
git add web/src/game/OfficeScene.ts web/src/game/OfficeScene.test.ts
git commit -m "feat: scale agents and animate walking"
```

### Task 3: Full verification and visual review

**Files:**
- No source changes expected; inspect `web/src/game/OfficeScene.ts` and the running local scene.

- [ ] **Step 1: Run the full test suite**

Run `npm test -- --run` from `web/`.
Expected: all existing and new tests pass.

- [ ] **Step 2: Run the production build**

Run `npm run build` from `web/`.
Expected: TypeScript and Vite build pass; only the existing chunk-size warning may remain.

- [ ] **Step 3: Inspect the local browser**

Open or refresh `http://127.0.0.1:5173/`. Confirm that agents are visibly larger than the desks, their labels remain above their heads, they walk only while changing zones, and they return to their status pose when movement ends.

- [ ] **Step 4: Commit any verification-only documentation adjustment**

If the visual check reveals a pure layout offset, update the same `OfficeScene.ts` constants and repeat the focused/full tests before committing with:

```bash
git add web/src/game/OfficeScene.ts web/src/game/OfficeScene.test.ts
git commit -m "fix: tune scaled agent layout"
```
