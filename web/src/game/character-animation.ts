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

export type CharacterFacing = "up" | "down" | "left" | "right";

export const CHARACTER_HAIR_BY_ROLE: Record<string, string> = {
  builder: "hair-short",
  tester: "hair-swept",
  documenter: "hair-curly",
};

const REQUIRED_ANIMATIONS: Record<string, Omit<CharacterAnimation, "name">> = {
  idle: { start: 0, frames: 8, fps: 5, loop: true },
  "walk-up": { start: 8, frames: 8, fps: 10, loop: true },
  "walk-down": { start: 16, frames: 8, fps: 10, loop: true },
  "walk-left": { start: 24, frames: 8, fps: 10, loop: true },
  "walk-right": { start: 32, frames: 8, fps: 10, loop: true },
  sit: { start: 40, frames: 4, fps: 6, loop: true },
  typing: { start: 44, frames: 8, fps: 10, loop: true },
  thinking: { start: 52, frames: 4, fps: 5, loop: true },
  celebrate: { start: 56, frames: 6, fps: 10, loop: false },
  wave: { start: 62, frames: 4, fps: 8, loop: false },
  sleep: { start: 66, frames: 6, fps: 6, loop: true },
  talk: { start: 72, frames: 4, fps: 8, loop: true },
};

const REQUIRED_CELL = { width: 32, height: 32, columns: 12, rows: 7 };
const REQUIRED_ANCHOR = { x: 16, y: 28 };
const REQUIRED_STATES = [
  "waiting",
  "moving",
  "inspecting",
  "planning",
  "working",
  "sitting",
  "inactive",
  "talking",
  "starting",
  "completed",
];

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

function isCharacterAnimation(value: unknown): value is CharacterAnimation {
  if (typeof value !== "object" || value === null) return false;

  const animation = value as Partial<CharacterAnimation>;
  return (
    typeof animation.name === "string" &&
    Number.isInteger(animation.start) &&
    Number.isInteger(animation.frames) &&
    Number.isFinite(animation.fps) &&
    typeof animation.loop === "boolean"
  );
}

function isStateMap(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateCharacterManifest(manifest: unknown): string[] {
  if (!isManifest(manifest)) return ["Manifest must be an object."];

  const errors: string[] = [];
  const { cell, animations } = manifest;
  const capacity = cell?.columns * cell?.rows;

  if (
    cell?.width !== REQUIRED_CELL.width ||
    cell?.height !== REQUIRED_CELL.height ||
    cell?.columns !== REQUIRED_CELL.columns ||
    cell?.rows !== REQUIRED_CELL.rows
  ) {
    errors.push("Manifest must use the required 32x32, 12 by 7 cell grid.");
  }

  if (
    manifest.anchor?.x !== REQUIRED_ANCHOR.x ||
    manifest.anchor?.y !== REQUIRED_ANCHOR.y
  ) {
    errors.push("Manifest must use the required anchor point.");
  }

  if (!Number.isInteger(capacity) || capacity <= 0) {
    errors.push("Manifest must define a positive cell capacity.");
  }

  if (!Array.isArray(animations)) {
    return [...errors, "Manifest must define animations."];
  }

  if (!animations.every(isCharacterAnimation)) {
    errors.push("Every animation entry must be well formed.");
  }

  for (const animation of animations) {
    if (
      !isCharacterAnimation(animation) ||
      animation.start < 0 ||
      animation.frames <= 0 ||
      animation.fps <= 0 ||
      (Number.isInteger(capacity) && animation.start + animation.frames > capacity)
    ) {
      errors.push("Animation entries must reference frames inside the atlas.");
      break;
    }
  }

  for (const [name, required] of Object.entries(REQUIRED_ANIMATIONS)) {
    const animation = animations.find((candidate) => candidate?.name === name);
    if (!animation) {
      errors.push(`Missing required animation: ${name}.`);
      continue;
    }
    if (
      animation.start !== required.start ||
      animation.frames !== required.frames ||
      animation.fps !== required.fps ||
      animation.loop !== required.loop
    ) {
      errors.push(`Animation ${name} does not match its required metadata.`);
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

  if (!isStateMap(manifest.stateMap)) {
    errors.push("Manifest must define an interaction state map.");
  } else {
    const validTargets = new Set(animations.filter(isCharacterAnimation).map((animation) => animation.name));
    for (const state of REQUIRED_STATES) {
      const target = manifest.stateMap[state];
      if (target !== "walk" && !validTargets.has(target)) {
        errors.push(`State ${state} must map to a valid animation target.`);
      }
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

export function hairAtlasForRole(role?: string): string {
  return CHARACTER_HAIR_BY_ROLE[role?.toLowerCase() ?? ""] ?? "hair-short";
}

export function animationStateForStatus(status: string): string {
  if (status === "working") return "working";
  if (status === "idle") return "sitting";
  if (status === "blocked" || status === "error") return "talking";
  if (status === "paused" || status === "stopped") return "inactive";
  return "waiting";
}

export function directionForMovement(
  from: { x: number; y: number },
  to: { x: number; y: number },
  lastFacing: CharacterFacing,
): CharacterFacing {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY) && deltaX !== 0) return deltaX > 0 ? "right" : "left";
  if (deltaY !== 0) return deltaY > 0 ? "down" : "up";
  return lastFacing;
}
