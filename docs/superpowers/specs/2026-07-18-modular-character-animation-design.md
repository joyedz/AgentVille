# Modular Character Animation Design

## Goal

Provide a reusable pixel-character asset system for AgentVille that makes every visible agent interaction feel smooth and legible while matching the existing 16px/32px office-furniture scale.

## Scope

This work delivers a single modular character body and independent hair overlays. The initial three hair silhouettes are short, swept, and curly. Hair and role accents are runtime selections, not separate character sheets.

The system includes animations for Idle, directional Walk, Sit, Typing, Thinking, Celebrate, Wave, Sleep, and Talk. It also provides a machine-readable animation manifest and a preview surface for visual inspection.

It does not add costumes, a character editor, or a separate full sprite sheet for each role.

## Asset contract

- Each frame occupies one 32x32px transparent cell, with a 24x28px character silhouette aligned to the tile baseline.
- A base-body PNG atlas contains every animation frame.
- Three transparent PNG hair-overlay atlases use the same cell order, dimensions, and anchor point as the body atlas.
- A JSON manifest defines the source rectangle, frame ordering, frames per second, loop behavior, and interruption behavior for each animation.
- The manifest maps interaction states to animation names and always includes `idle` as the fallback animation.

### Required animations

| Animation | Frames | Playback |
| --- | ---: | --- |
| Idle | 8 | loop, 5fps |
| Walk Up | 8 | loop, 10fps |
| Walk Down | 8 | loop, 10fps |
| Walk Left | 8 | loop, 10fps |
| Walk Right | 8 | loop, 10fps |
| Sit | 4 | loop, 6fps |
| Typing | 8 | loop, 10fps |
| Thinking | 4 | loop, 5fps |
| Celebrate | 6 | once, 10fps |
| Wave | 4 | once, 8fps |
| Sleep | 6 | loop, 6fps |
| Talk | 4 | loop, 8fps |

The high end of each user-provided frame range is the initial production target. Shorter loops may be introduced only after a visual review shows that the longer loop does not improve readability.

## Interaction mapping

| Interaction or agent state | Animation |
| --- | --- |
| waiting or unknown | Idle |
| moving to a zone | directional Walk |
| inspecting or planning | Thinking |
| implementing or working at a desk | Typing |
| idle at lounge or coffee area | Sit |
| long inactive period | Sleep |
| status update or conversational feedback | Talk |
| task start or greeting | Wave |
| successful approval or completion | Celebrate |

Movement derives facing from the movement vector. If the vector is zero, the last known facing direction is retained. Unknown interaction states and unavailable animations fall back to Idle.

## Runtime behavior

`CharacterAnimator` receives the current interaction state and facing direction, resolves the requested manifest animation, and controls a sprite instance plus its selected hair overlay. It preserves a compatible loop when the requested animation has not changed. State changes use a 120-180ms hold or cross-fade where the renderer supports it, preventing visible frame popping. One-shot Wave and Celebrate finish before returning to Idle unless a higher-priority state such as movement interrupts them.

## Validation and preview

Automated tests validate that every required animation exists, has the specified frame count, references in-bounds atlas cells, and declares valid playback metadata. Separate tests ensure every supported interaction state resolves to a valid animation and unknown states resolve to Idle.

A lightweight preview scene/page renders the body with each hair overlay and cycles all animations. It is the visual acceptance surface for baseline alignment, hair/body registration, directional walk readability, loop continuity, and one-shot return behavior.

## Acceptance criteria

- One base-body atlas and three aligned hair-overlay atlases exist.
- The manifest exposes all twelve requested animation names with the listed frame counts.
- Every interaction in the mapping table visibly starts the intended animation without a hard visual pop.
- Hair overlays remain aligned with the body through every frame.
- Unknown states and failed asset lookups visibly fall back to Idle.
- Automated manifest and state-resolution tests pass.
