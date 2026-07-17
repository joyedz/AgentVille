# Agent Footstep and Furniture Depth Design

## Goal

Replace the gliding walk effect with visible footfalls and keep agents grounded in front of furniture instead of standing on desk surfaces.

## Walk assets and animation

- Extend each role sheet with four dedicated walk frames after the four stationary status frames. The sheet therefore contains eight 48x72 frames (384x72 total).
- Walk frames represent contact, passing, stride, and passing poses with alternating legs, small arm swing, and a subtle torso shift. The frames are role-colored and remain transparent pixel art.
- Animate the four walk frames in order at 90 ms per frame while a movement tween is active.
- Keep stationary status mapping unchanged: frames 0-3 remain idle/working/blocked-paused poses.

## Furniture anchors and depth

- Move the three desk seats from the desktop baseline to floor anchors in front of the chairs (approximately y=335), without changing the fixed 960x640 canvas.
- Keep coffee, lounge, and attention anchors aligned to their floor areas; adjust only if visual inspection shows a character intersecting a prop.
- Render the flattened background first, then agent containers, then labels/status markers. Keep the empty-desk interaction zone behind agent containers and preserve existing callbacks.
- Keep agents selectable through the enlarged container hit area; depth changes must not disable pointer events.

## Verification

- Add asset-contract tests for 384x72 role sheets and the four-frame walk range.
- Add scene tests that prove the walk timer uses frames 4-7 at 90 ms, stationary status frames remain 0-3, and desk positions use the new floor anchor.
- Run the full test suite and production build.
- Visually inspect the local browser for grounded feet, readable footfalls, and furniture that remains visible around agents.
