import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class MockScene {
    add = {};
    cameras = { main: { setBackgroundColor: vi.fn() } };
    events = { once: vi.fn() };
    input = { keyboard: { on: vi.fn(), off: vi.fn() } };
    load = { image: vi.fn(), json: vi.fn(), spritesheet: vi.fn() };
    cache = { json: { get: vi.fn() } };
    anims = { create: vi.fn(), generateFrameNumbers: vi.fn(), exists: vi.fn() };
    tweens = { add: vi.fn() };
    time = { addEvent: vi.fn() };
  }

  return {
    default: {
      AUTO: 0,
      Game: vi.fn(),
      Scale: { FIT: 1, CENTER_BOTH: 2 },
      Scene: MockScene
    }
  };
});

import Phaser from 'phaser';
import { officeAssetManifest, officeCanvas } from './office-assets.js';
import { createOfficeGame, OfficeScene } from './OfficeScene.js';
import type { CharacterManifest } from './character-animation.js';

type TimerConfig = { delay: number; loop: boolean; callback: () => void };
type TweenConfig = { duration: number; x?: number; y?: number; onComplete?: () => void; onStop?: () => void };
type ContainerMock = {
  listeners: Record<string, () => void>;
  setSize: ReturnType<typeof vi.fn>;
  setInteractive: ReturnType<typeof vi.fn>;
  setDepth: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

function prepareScene(onAgentSelected = vi.fn()) {
  const scene = new OfficeScene(onAgentSelected);
  const sprites: Array<Record<string, ReturnType<typeof vi.fn>>> = [];
  const containers: ContainerMock[] = [];
  const timers: Array<{ remove: ReturnType<typeof vi.fn> }> = [];
  const timerConfigs: TimerConfig[] = [];
  const tweenConfigs: TweenConfig[] = [];
  const tweens: Array<{ stop: ReturnType<typeof vi.fn> }> = [];
  const image = { setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis() };
  const manifest: CharacterManifest = {
    cell: { width: 32, height: 32, columns: 12, rows: 7 }, anchor: { x: 16, y: 28 },
    animations: [
      { name: 'idle', start: 0, frames: 8, fps: 5, loop: true }, { name: 'walk-up', start: 8, frames: 8, fps: 10, loop: true }, { name: 'walk-down', start: 16, frames: 8, fps: 10, loop: true }, { name: 'walk-left', start: 24, frames: 8, fps: 10, loop: true }, { name: 'walk-right', start: 32, frames: 8, fps: 10, loop: true }, { name: 'sit', start: 40, frames: 4, fps: 6, loop: true }, { name: 'typing', start: 44, frames: 8, fps: 10, loop: true }, { name: 'thinking', start: 52, frames: 4, fps: 5, loop: true }, { name: 'celebrate', start: 56, frames: 6, fps: 10, loop: false }, { name: 'wave', start: 62, frames: 4, fps: 8, loop: false }, { name: 'sleep', start: 66, frames: 6, fps: 6, loop: true }, { name: 'talk', start: 72, frames: 4, fps: 8, loop: true }
    ],
    stateMap: { waiting: 'idle', moving: 'walk', inspecting: 'thinking', planning: 'thinking', working: 'typing', sitting: 'sit', inactive: 'sleep', talking: 'talk', starting: 'wave', completed: 'celebrate' }
  };
  (scene.cache.json.get as ReturnType<typeof vi.fn>).mockReturnValue(manifest);
  (scene.anims.generateFrameNumbers as ReturnType<typeof vi.fn>).mockImplementation((texture: string, range: unknown) => [{ texture, range }]);

  (scene.time.addEvent as ReturnType<typeof vi.fn>).mockImplementation((config: TimerConfig) => {
    timerConfigs.push(config);
    const timer = { remove: vi.fn() };
    timers.push(timer);
    return timer;
  });
  (scene.tweens.add as ReturnType<typeof vi.fn>).mockImplementation((config: TweenConfig) => {
    tweenConfigs.push(config);
    const tween = { stop: vi.fn() };
    tweens.push(tween);
    return tween;
  });
  scene.add = {
    image: vi.fn().mockReturnValue(image),
    rectangle: vi.fn().mockReturnValue({
      setStrokeStyle: vi.fn().mockReturnThis(),
      setFillStyle: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis()
    }),
    sprite: vi.fn().mockImplementation(() => {
      const sprite = {
        setOrigin: vi.fn().mockReturnThis(),
        setFrame: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        setTexture: vi.fn().mockReturnThis(),
        play: vi.fn().mockReturnThis()
      };
      sprites.push(sprite);
      return sprite;
    }),
    text: vi.fn().mockReturnValue({
      setOrigin: vi.fn().mockReturnThis(),
      setText: vi.fn().mockReturnThis(),
      setBackgroundColor: vi.fn().mockReturnThis()
    }),
    container: vi.fn().mockImplementation(() => {
      const listeners: Record<string, () => void> = {};
      const container: ContainerMock = {
        listeners,
        setSize: vi.fn().mockReturnThis(),
        setInteractive: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        on: vi.fn((event: string, callback: () => void) => { listeners[event] = callback; }),
        destroy: vi.fn()
      };
      containers.push(container);
      return container;
    })
  } as unknown as typeof scene.add;

  return { scene, image, sprites, containers, timers, timerConfigs, tweenConfigs, tweens };
}

const builderAtDesk = { id: 'builder', name: 'Builder', status: 'working', zone: 'desk' as const };

describe('OfficeScene pixel office background', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preloads the office surface plus modular body and hair character atlases', () => {
    const scene = new OfficeScene(vi.fn());
    scene.preload();
    expect(scene.load.image).toHaveBeenCalledWith('office-background', officeAssetManifest.background);
    expect(scene.load.json).toHaveBeenCalledWith('character-manifest', '/assets/characters/manifest.json');
    expect(scene.load.spritesheet).toHaveBeenCalledWith('character-body', '/assets/characters/body.png', { frameWidth: 32, frameHeight: 32 });
    expect(scene.load.spritesheet).toHaveBeenCalledWith('hair-short', '/assets/characters/hair-short.png', { frameWidth: 32, frameHeight: 32 });
    expect(scene.load.spritesheet).toHaveBeenCalledWith('hair-swept', '/assets/characters/hair-swept.png', { frameWidth: 32, frameHeight: 32 });
    expect(scene.load.spritesheet).toHaveBeenCalledWith('hair-curly', '/assets/characters/hair-curly.png', { frameWidth: 32, frameHeight: 32 });
    expect(scene.load.image).toHaveBeenCalledWith('office-status-markers', officeAssetManifest.markers);
    expect(scene.load.image).toHaveBeenCalledWith('office-props', officeAssetManifest.props);
    expect(scene.load.image).toHaveBeenCalledWith('office-nameplates', officeAssetManifest.nameplates);
  });

  it('uses a fixed pixel-art renderer at the office canvas dimensions', () => {
    createOfficeGame(document.createElement('div'), vi.fn());
    expect(Phaser.Game).toHaveBeenCalledWith(expect.objectContaining({
      width: officeCanvas.width,
      height: officeCanvas.height,
      render: { antialias: false, pixelArt: true }
    }));
  });

  it('layers a selectable agent above the background with no invisible hit zone', () => {
    const onAgentSelected = vi.fn();
    const { scene, image, containers } = prepareScene(onAgentSelected);
    scene.create();
    scene.updateAgents([builderAtDesk]);

    expect(image.setDepth).toHaveBeenCalledWith(0);
    // The agent container is the only interactive object over the map; there is
    // no invisible empty-desk zone that could trigger stray assignments.
    expect((scene.add as { zone?: unknown }).zone).toBeUndefined();
    expect(scene.add.container).toHaveBeenCalledWith(330, 335, expect.any(Array));
    expect(containers[0]?.setSize).toHaveBeenCalledWith(96, 148);
    expect(containers[0]?.setDepth).toHaveBeenCalledWith(2);
    expect((scene.add.image as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]).toBeLessThan(
      (scene.add.container as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0] ?? Infinity
    );

    containers[0]?.listeners.pointerup?.();
    expect(onAgentSelected).toHaveBeenCalledWith('builder');
  });

  it('keeps each agent on a stable seat so an assignment fills an empty desk', () => {
    const { scene, tweenConfigs } = prepareScene();
    // Two agents at their desks; the third is away in the lounge.
    scene.updateAgents([
      { id: 'builder', name: 'Builder', status: 'working', zone: 'desk' },
      { id: 'documenter', name: 'Documenter', status: 'stopped', zone: 'lounge' },
      { id: 'tester', name: 'Tester', status: 'working', zone: 'desk' }
    ]);

    const containerCalls = (scene.add.container as ReturnType<typeof vi.fn>).mock.calls;
    // Sorted order is builder, documenter, tester -> stable seats 0, 1, 2.
    expect(containerCalls[0]?.slice(0, 2)).toEqual([330, 335]); // builder at desk seat 0
    expect(containerCalls[2]?.slice(0, 2)).toEqual([630, 335]); // tester keeps desk seat 2

    // The away agent returns to the desk and must fill its own empty seat (1).
    scene.updateAgents([
      { id: 'builder', name: 'Builder', status: 'working', zone: 'desk' },
      { id: 'documenter', name: 'Documenter', status: 'working', zone: 'desk' },
      { id: 'tester', name: 'Tester', status: 'working', zone: 'desk' }
    ]);

    // Only the returning agent moves, and it lands on the empty middle desk.
    expect(tweenConfigs).toHaveLength(1);
    expect(tweenConfigs[0]).toMatchObject({ x: 480, y: 335 });
  });

  it('packs break-area agents into distinct seats without overlap', () => {
    const { scene } = prepareScene();
    scene.updateAgents([
      { id: 'builder', name: 'Builder', status: 'idle', zone: 'lounge' },
      { id: 'documenter', name: 'Documenter', status: 'idle', zone: 'lounge' },
      { id: 'tester', name: 'Tester', status: 'stopped', zone: 'lounge' }
    ]);

    const containerCalls = (scene.add.container as ReturnType<typeof vi.fn>).mock.calls;
    const seats = containerCalls.slice(0, 3).map((call) => `${call[0]},${call[1]}`);
    // Two lounge seats fill first, then the third spills into the coffee area.
    expect(seats).toEqual(['520,500', '650,500', '150,500']);
    expect(new Set(seats).size).toBe(3);
  });

  it.each([
    ['idle', 'sit'],
    ['stopped', 'sleep'],
    ['working', 'typing'],
    ['blocked', 'talk'],
    ['error', 'talk'],
    ['paused', 'sleep']
  ])('maps stationary status %s to the %s body and hair animation', (status, animation) => {
    const { scene, sprites } = prepareScene();
    scene.updateAgents([{ id: status, name: status, status, zone: 'desk' }]);
    expect(sprites[0]?.play).toHaveBeenCalledWith(`character-body-${animation}`);
    expect(sprites[1]?.play).toHaveBeenCalledWith(`hair-short-${animation}`);
  });

  it('chooses the role hair overlay and preserves label/marker children above its body layers', () => {
    const { scene, sprites } = prepareScene();
    scene.updateAgents([{ id: 'tester', name: 'Tester', role: 'Tester', status: 'working', zone: 'desk' }]);
    expect(scene.add.sprite).toHaveBeenCalledWith(0, 0, 'character-body', 0);
    expect(scene.add.sprite).toHaveBeenCalledWith(0, 0, 'hair-swept', 0);
    expect(sprites[0]?.play).toHaveBeenCalledWith('character-body-typing');
    expect(sprites[1]?.play).toHaveBeenCalledWith('hair-swept-typing');
    expect(scene.add.container).toHaveBeenCalledWith(330, 335, expect.any(Array));
    const children = (scene.add.container as ReturnType<typeof vi.fn>).mock.calls[0]?.[2] as unknown[];
    expect(children[1]).toBe((scene.add.sprite as ReturnType<typeof vi.fn>).mock.results[0]?.value);
    expect(children[2]).toBe((scene.add.sprite as ReturnType<typeof vi.fn>).mock.results[1]?.value);
    expect(children).toHaveLength(5);
  });

  it('plays matched directional walk layers and restores status on completion', () => {
    const { scene, sprites, tweenConfigs } = prepareScene();
    scene.updateAgents([builderAtDesk]);
    scene.updateAgents([{ ...builderAtDesk, zone: 'coffee' }]);

    expect(sprites[0]?.play).toHaveBeenLastCalledWith('character-body-walk-left');
    expect(sprites[1]?.play).toHaveBeenLastCalledWith('hair-short-walk-left');
    expect(tweenConfigs[0]).toMatchObject({ duration: 360 });
    tweenConfigs[0]?.onComplete?.();
    expect(sprites[0]?.play).toHaveBeenLastCalledWith('character-body-typing');
    expect(sprites[1]?.play).toHaveBeenLastCalledWith('hair-short-typing');
  });

  it('restores the status animation when motion is cancelled or the agent is removed', () => {
    const { scene, sprites, tweenConfigs, tweens, containers } = prepareScene();
    scene.updateAgents([builderAtDesk]);
    scene.updateAgents([{ ...builderAtDesk, zone: 'coffee' }]);
    tweenConfigs[0]?.onStop?.();
    expect(sprites[0]?.play).toHaveBeenLastCalledWith('character-body-typing');
    expect(sprites[1]?.play).toHaveBeenLastCalledWith('hair-short-typing');

    scene.updateAgents([{ ...builderAtDesk, zone: 'lounge' }]);
    scene.updateAgents([]);
    expect(tweens[1]?.stop).toHaveBeenCalledTimes(1);
    expect(containers[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(sprites[0]?.play).toHaveBeenLastCalledWith('character-body-typing');
  });

  it('supersedes a retarget without allowing stale callbacks to clear the new walk', () => {
    const { scene, sprites, tweenConfigs } = prepareScene();
    scene.updateAgents([builderAtDesk]);
    scene.updateAgents([{ ...builderAtDesk, zone: 'coffee' }]);
    scene.updateAgents([{ ...builderAtDesk, status: 'paused', zone: 'lounge' }]);

    expect(sprites[0]?.play).toHaveBeenLastCalledWith('character-body-walk-right');
    expect(sprites[1]?.play).toHaveBeenLastCalledWith('hair-short-walk-right');
    tweenConfigs[0]?.onComplete?.();
    expect(sprites[0]?.play).toHaveBeenLastCalledWith('character-body-walk-right');
    tweenConfigs[1]?.onComplete?.();
    expect(sprites[0]?.play).toHaveBeenLastCalledWith('character-body-sleep');
  });
});
