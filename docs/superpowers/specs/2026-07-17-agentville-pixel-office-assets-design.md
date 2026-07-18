# AgentVille Pixel Office Asset Refresh Design

**Date:** 2026-07-17
**Status:** Approved direction

## Goal

Replace the current geometric placeholder map with a cozy top-down pixel-art office inspired by the supplied reference image. Preserve AgentVille's live control-plane behavior while making the map feel like a place occupied by coding agents.

## Chosen approach

Use a precomposed pixel-art office background with live Phaser overlays. The background owns the room composition, floors, walls, furniture, props, and decorative texture. Phaser continues to own agent state, click targets, assignment hit areas, selection, status badges, and motion between zones.

This is the smallest approach that delivers the reference's visual density without replacing the existing state and interaction architecture with a full tilemap editor or simulation engine.

## Asset system

Create a pixel-art asset pack with:

- one wide office background containing desk, coffee, lounge, and attention areas;
- three distinct agent sprite sheets with readable idle/working/blocked/paused poses;
- reusable desk, monitor, coffee, lounge, plant, shelving, and attention props;
- pixel nameplates and status markers;
- a selection glow and room-state overlays;
- a small atlas/tileset boundary for future room expansion.

Assets should use nearest-neighbor scaling, transparent backgrounds for sprites, and a restrained palette that keeps status colors legible. The office background must remain visually understandable at the browser's minimum supported width; props are decorative and must not obscure agent click targets.

## Runtime integration

`OfficeScene` will load the background and prop assets during Phaser preload/create, then place live agents on top using the existing zone-position mapping. Agent overlays remain keyed by agent id so state updates only change sprite frame, nameplate, status badge, and position. Existing map callbacks (`onAgentSelected`, `onEmptyDeskSelected`) remain the interaction contract.

The inspector, command queue, WebSocket snapshot validation, and server protocol are out of scope for redesign. The visual refresh must not change agent statuses, command behavior, persistence, or the mock/Codex runner contracts.

## Visual behavior

- working agents use a subtle monitor glow or typing frame;
- blocked agents use an amber attention marker and a small speech bubble;
- paused/stopped agents use a muted badge without disappearing;
- selected agents receive a high-contrast outline and nameplate emphasis;
- empty desks retain a visible assignment affordance;
- room labels are pixel-styled but remain readable to keyboard and screen-reader users through existing surrounding UI text.

## Asset provenance and implementation boundary

The supplied image is reference art direction, not an asset to copy. New bitmap assets should be original/generated or hand-authored for AgentVille, with no unlicensed third-party sprites. Generated assets are stored in the repository's web asset directory and referenced by stable filenames.

The first implementation pass should prioritize one coherent office background and the live agent overlays. Detailed animation, pathfinding, room transitions, and a fully editable tilemap are deferred.

## Verification

- render the browser at desktop and narrow viewport widths;
- verify the office background, sprites, nameplates, and status markers load without network requests;
- verify agent selection and empty-desk assignment still work;
- verify all status colors remain distinguishable against the pixel palette;
- run the existing web tests and production build;
- add focused scene/asset loading tests where Phaser can be mocked without requiring a real browser canvas.

