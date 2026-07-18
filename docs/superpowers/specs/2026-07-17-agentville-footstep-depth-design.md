# Agent Footstep and Furniture Depth Design

## Goal

Replace the gliding walk effect with readable footfalls and keep agents grounded on the floor in front of furniture rather than standing on desktop surfaces.

## Walk assets and animation

- Update each role sheet (`agent-builder.png`, `agent-tester.png`, and `agent-documenter.png`) to eight transparent RGBA `48x72` frames in one `384x72` sheet. Preserve or document the editable pixel-art source or authoring process with the rendered PNGs so the walk poses can be maintained.
- Preserve the stationary status mapping: `idle` and `stopped` use frame 0; `working` uses frame 1; `blocked` and `error` use frame 2; `paused` uses frame 3.
- Use frames 4-7 exclusively for walking: contact, passing, stride, and passing. The poses use alternating legs, a small arm swing, a subtle torso shift, role-appropriate colors, and transparent pixel-art backgrounds.
- When a movement tween begins, show frame 4 immediately. Advance to frames 5, 6, and 7 every 90 ms, then restore the stored stationary status frame when movement completes, is cancelled, or is superseded by a retarget.
- Set the movement tween duration to 360 ms. This gives each of the four walking frames a full 90 ms display interval: frame 4 at 0 ms, frame 5 at 90 ms, frame 6 at 180 ms, and frame 7 at 270 ms.

## Furniture anchors and depth

- Keep the fixed `960x640` canvas. Move the three desk anchors to the floor in front of their chairs: `{ x: 330, y: 335 }`, `{ x: 480, y: 335 }`, and `{ x: 630, y: 335 }`.
- Leave coffee, lounge, and attention anchors unchanged unless the visual acceptance criteria below fail. Any adjustment must keep the agent's feet on an open floor area rather than a tabletop, sofa, or other prop.
- Render the flattened furniture background before the interactive empty-desk zone and agent containers. Keep the empty-desk zone behind agent containers so an overlapping agent receives the pointer event.
- Keep labels and status markers as children of their agent container, ordered above that agent's sprite. They are not required to layer globally above sprites in other agent containers; introduce a dedicated global UI layer only if that requirement is added later.
- Preserve the existing enlarged `96x148` interactive agent container. Depth changes must not disable pointer events or the existing agent-selection and empty-desk callbacks.

## Visual acceptance criteria

- Each desk agent's feet rest at its floor anchor; the desk surface and chair remain visibly legible around the agent.
- A moving agent visibly alternates through all four walking poses without a glide-only appearance, then returns to the correct stationary pose.
- Coffee, lounge, and attention agents remain grounded, do not cover a table surface, and keep their labels and markers within the fixed canvas.
- The foreground agent is selectable wherever its hit area overlaps the empty-desk interaction zone.

## Verification

- Update asset-contract tests to require all role sheets to be `384x72` RGBA PNGs and to require `walkFrames` to equal `[4, 5, 6, 7]` at a 90 ms frame duration. Retain a visual asset review to confirm that walking frames are populated, distinct, role-colored, and transparent.
- Add scene tests proving that frame 4 is displayed at movement start; timer ticks display frames 5, 6, and 7 at 90 ms intervals; completion, cancellation, removal, and retargeting restore or preserve the appropriate stationary frame and clean up the timer.
- Add scene tests for every supported stationary status mapping, including `stopped` and `error` aliases.
- Update position tests for all three desk floor anchors and retain the coffee, lounge, and attention coordinate assertions.
- Add interaction/layering tests proving agent `pointerup` calls `onAgentSelected`, empty-desk `pointerup` preserves its callback, and an overlapping agent remains the selectable foreground target.
- Run `npm test` and `npm run build`.
- Start the local application and perform the visual acceptance review at responsive scaling before accepting the change.
