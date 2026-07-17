# Agent Scale and Walk Animation Design

## Goal

Make the human agents easier to see in the pixel office and add a readable walk cycle while they move between office zones.

## Visual behavior

- Render the existing 48x72 human sprite frames at 1.5x scale, producing a 72x108 visible character footprint.
- Enlarge the selection outline and interactive container to cover the scaled sprite while keeping labels and status markers above the head.
- Keep the current status-frame mapping when an agent is stationary: idle/stopped, working, blocked/error, and paused remain visually distinct.
- During a position transition, temporarily alternate two existing sprite poses at approximately 140 ms per step while the container tween runs.
- When the movement tween completes, stop the walk cycle and restore the frame associated with the agent's current status.

## Runtime design

`OfficeScene.updateAgents` remains the source of target positions. Each agent view tracks whether a movement tween and walk timer are active. A target change starts the container tween and walk cycle; completion cancels the timer and applies the status frame. Removing an agent destroys its container and any animation timer.

The implementation must remain compatible with Phaser's mocked scene used by unit tests, so timer/tween calls are isolated behind small scene methods or guarded calls.

## Interaction and accessibility

- Preserve the existing agent selection callback and empty-desk callback.
- Keep hit areas large enough for the scaled body and labels without changing zone coordinates.
- Do not change the fixed 960x640 canvas or furniture background.

## Verification

- Add unit tests proving the scaled sprite/outline/container dimensions.
- Add unit tests proving a target change starts the walk state and tween, and tween completion restores the status frame.
- Run the full Vitest suite and production build.
- Visually inspect the local browser to confirm agents remain readable and do not obscure key furniture.
