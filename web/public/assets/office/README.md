# AgentVille pixel office assets

This directory is the asset contract for the AgentVille pixel office. The
bitmap files are original/generated for AgentVille and are not copied from the
supplied reference image.

The office is rendered with nearest-neighbor scaling so pixel edges remain
crisp at responsive canvas sizes.

Asset dimensions: `office-background.png` is 960x640; agent sheets are 128x48
(four 32x48 frames); markers are 120x24; props are 256x128; and nameplates are
640x24. Agent and decorative sheets use RGBA transparency with clean pixel
edges. The built-in image generation service returned HTTP 403 in this
environment, so this first-pass pack is hand-authored with deterministic
standard-library PNG generation (no third-party or reference-image pixels).
