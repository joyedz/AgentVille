import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class MockScene {
    add = {};
    cameras = { main: { setBackgroundColor: vi.fn() } };
    events = { once: vi.fn() };
    input = { keyboard: { on: vi.fn(), off: vi.fn() } };
    load = { image: vi.fn(), spritesheet: vi.fn() };
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
import { agentPresentation, agentSprite, officeAssetManifest, officeCanvas } from './office-assets.js';
import { createOfficeGame, OfficeScene } from './OfficeScene.js';

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
        setTexture: vi.fn().mockReturnThis()
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

  it('preloads every office asset from the manifest', () => {
    const scene = new OfficeScene(vi.fn());
    scene.preload();
    expect(scene.load.image).toHaveBeenCalledWith('office-background', officeAssetManifest.background);
    expect(scene.load.spritesheet).toHaveBeenCalledWith('agent-builder', officeAssetManifest.agents.builder, agentSprite);
    expect(scene.load.spritesheet).toHaveBeenCalledWith('agent-tester', officeAssetManifest.agents.tester, agentSprite);
    expect(scene.load.spritesheet).toHaveBeenCalledWith('agent-documenter', officeAssetManifest.agents.documenter, agentSprite);
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
    ['idle', 0],
    ['stopped', 0],
    ['working', 1],
    ['blocked', 2],
    ['error', 2],
    ['paused', 3]
  ])('maps stationary status %s to frame %i', (status, frame) => {
    const { scene, sprites } = prepareScene();
    scene.updateAgents([{ id: status, name: status, status, zone: 'desk' }]);
    expect(sprites[0]?.setFrame).toHaveBeenLastCalledWith(frame);
  });

  it('chooses the role texture and preserves label/marker children above its body', () => {
    const { scene, sprites } = prepareScene();
    scene.updateAgents([{ id: 'tester', name: 'Tester', role: 'Tester', status: 'working', zone: 'desk' }]);
    expect(scene.add.sprite).toHaveBeenCalledWith(0, 0, 'agent-tester', 0);
    expect(sprites[0]?.setScale).toHaveBeenCalledWith(agentPresentation.scale);
    expect(sprites[0]?.setFrame).toHaveBeenLastCalledWith(1);
    expect(scene.add.container).toHaveBeenCalledWith(330, 335, expect.any(Array));
    const children = (scene.add.container as ReturnType<typeof vi.fn>).mock.calls[0]?.[2] as unknown[];
    expect(children[1]).toBe((scene.add.sprite as ReturnType<typeof vi.fn>).mock.results[0]?.value);
    expect(children).toHaveLength(4);
  });

  it('shows frame 4 synchronously, advances frames 5–7 every 90 ms, and restores status on completion', () => {
    const { scene, sprites, timerConfigs, tweenConfigs, timers } = prepareScene();
    scene.updateAgents([builderAtDesk]);
    scene.updateAgents([{ ...builderAtDesk, zone: 'coffee' }]);

    expect(sprites[0]?.setFrame).toHaveBeenLastCalledWith(4);
    expect(timerConfigs[0]).toMatchObject({ delay: 90, loop: true });
    expect(tweenConfigs[0]).toMatchObject({ duration: 360 });
    timerConfigs[0]?.callback();
    expect(sprites[0]?.setFrame).toHaveBeenLastCalledWith(5);
    timerConfigs[0]?.callback();
    expect(sprites[0]?.setFrame).toHaveBeenLastCalledWith(6);
    timerConfigs[0]?.callback();
    expect(sprites[0]?.setFrame).toHaveBeenLastCalledWith(7);
    tweenConfigs[0]?.onComplete?.();
    expect(timers[0]?.remove).toHaveBeenCalledTimes(1);
    expect(sprites[0]?.setFrame).toHaveBeenLastCalledWith(1);
  });

  it('cleans up the timer and restores the stationary frame when motion is cancelled or the agent is removed', () => {
    const { scene, sprites, timerConfigs, tweenConfigs, timers, tweens, containers } = prepareScene();
    scene.updateAgents([builderAtDesk]);
    scene.updateAgents([{ ...builderAtDesk, zone: 'coffee' }]);
    tweenConfigs[0]?.onStop?.();
    expect(timers[0]?.remove).toHaveBeenCalledTimes(1);
    expect(sprites[0]?.setFrame).toHaveBeenLastCalledWith(1);

    scene.updateAgents([{ ...builderAtDesk, zone: 'lounge' }]);
    scene.updateAgents([]);
    expect(timers[1]?.remove).toHaveBeenCalledTimes(1);
    expect(tweens[1]?.stop).toHaveBeenCalledTimes(1);
    expect(containers[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(sprites[0]?.setFrame).toHaveBeenLastCalledWith(1);
    expect(timerConfigs).toHaveLength(2);
  });

  it('supersedes a retarget without allowing stale callbacks to clear the new walk', () => {
    const { scene, sprites, timerConfigs, tweenConfigs, timers } = prepareScene();
    scene.updateAgents([builderAtDesk]);
    scene.updateAgents([{ ...builderAtDesk, zone: 'coffee' }]);
    scene.updateAgents([{ ...builderAtDesk, status: 'paused', zone: 'lounge' }]);

    expect(timers[0]?.remove).toHaveBeenCalledTimes(1);
    expect(sprites[0]?.setFrame).toHaveBeenLastCalledWith(4);
    tweenConfigs[0]?.onComplete?.();
    expect(timers[1]?.remove).not.toHaveBeenCalled();
    timerConfigs[1]?.callback();
    expect(sprites[0]?.setFrame).toHaveBeenLastCalledWith(5);
    tweenConfigs[1]?.onComplete?.();
    expect(timers[1]?.remove).toHaveBeenCalledTimes(1);
    expect(sprites[0]?.setFrame).toHaveBeenLastCalledWith(3);
  });
});
