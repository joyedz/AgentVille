export interface CharacterAnimation {
  name: string;
  start: number;
  frames: number;
  fps: number;
  loop: boolean;
}

export interface CharacterManifest {
  cell: { width: number; height: number; columns: number; rows: number };
  anchor: { x: number; y: number };
  animations: CharacterAnimation[];
  stateMap: Record<string, string>;
}

export interface ResolvedCharacterAnimation {
  name: string;
  animation: CharacterAnimation;
}

const REQUIRED_ANIMATIONS: Record<string, number> = {
  idle: 8,
  "walk-up": 8,
  "walk-down": 8,
  "walk-left": 8,
  "walk-right": 8,
  sit: 4,
  typing: 8,
  thinking: 4,
  celebrate: 6,
  wave: 4,
  sleep: 6,
  talk: 4,
};

const IDLE_FALLBACK: CharacterAnimation = {
  name: "idle",
  start: 0,
  frames: 1,
  fps: 1,
  loop: true,
};

function isManifest(value: unknown): value is CharacterManifest {
  return typeof value === "object" && value !== null;
}

export function validateCharacterManifest(manifest: unknown): string[] {
  if (!isManifest(manifest)) return ["Manifest must be an object."];

  const errors: string[] = [];
  const { cell, animations } = manifest;
  const capacity = cell?.columns * cell?.rows;

  if (!Number.isInteger(capacity) || capacity <= 0) {
    errors.push("Manifest must define a positive cell capacity.");
  }

  if (!Array.isArray(animations)) {
    return [...errors, "Manifest must define animations."];
  }

  for (const [name, requiredFrames] of Object.entries(REQUIRED_ANIMATIONS)) {
    const animation = animations.find((candidate) => candidate?.name === name);
    if (!animation) {
      errors.push(`Missing required animation: ${name}.`);
      continue;
    }
    if (animation.frames !== requiredFrames) {
      errors.push(`Animation ${name} must have ${requiredFrames} frames.`);
    }
    if (
      !Number.isInteger(animation.start) ||
      !Number.isInteger(animation.frames) ||
      animation.start < 0 ||
      animation.frames <= 0 ||
      (Number.isInteger(capacity) && animation.start + animation.frames > capacity)
    ) {
      errors.push(`Animation ${name} references frames outside the atlas.`);
    }
  }

  return errors;
}

export function resolveCharacterAnimation(
  manifest: CharacterManifest,
  state: string,
  facing: string,
): ResolvedCharacterAnimation {
  const animations = Array.isArray(manifest?.animations) ? manifest.animations : [];
  const mappedName = manifest?.stateMap?.[state];
  const name = mappedName === "walk" && ["up", "down", "left", "right"].includes(facing)
    ? `walk-${facing}`
    : mappedName;
  const animation = animations.find((candidate) => candidate.name === name)
    ?? animations.find((candidate) => candidate.name === "idle")
    ?? IDLE_FALLBACK;

  return { name: animation.name, animation };
}
