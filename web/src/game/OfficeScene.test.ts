import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class MockScene {
    add = {};
    cameras = { main: { setBackgroundColor: vi.fn() } };
    events = { once: vi.fn() };
    input = { keyboard: { on: vi.fn(), off: vi.fn() } };
    load = { image: vi.fn(), spritesheet: vi.fn() };
    tweens = { add: vi.fn() };
  }

  return {
    default: {
      AUTO: 0,
      Game: vi.fn(),
      Scale: { FIT: 1, CENTER_BOTH: 2 },
      Scene: MockScene,
      Textures: { FilterMode: { NEAREST: 1 } }
    }
  };
});

import Phaser from 'phaser';
import { agentSprite, officeAssetManifest, officeCanvas } from './office-assets.js';
import { createOfficeGame, OfficeScene } from './OfficeScene.js';

describe('OfficeScene pixel office background', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('adds the office background centered on the fixed pixel canvas', () => {
    const scene = new OfficeScene(vi.fn());
    const background = { setOrigin: vi.fn().mockReturnThis() };
    scene.add = { image: vi.fn().mockReturnValue(background) } as unknown as typeof scene.add;

    scene.create();

    expect(scene.add.image).toHaveBeenCalledWith(
      officeCanvas.width / 2,
      officeCanvas.height / 2,
      'office-background'
    );
    expect(background.setOrigin).toHaveBeenCalledWith(0.5);
  });

  it('uses a pixel-art renderer at the office canvas dimensions', () => {
    createOfficeGame(document.createElement('div'), vi.fn());

    expect(Phaser.Game).toHaveBeenCalledWith(expect.objectContaining({
      width: officeCanvas.width,
      height: officeCanvas.height,
      render: { antialias: false, pixelArt: true }
    }));
  });

  it('selects a role sprite, status frame, and selection outline', () => {
    const scene = new OfficeScene(vi.fn());
    const sprite = { setOrigin: vi.fn().mockReturnThis(), setFrame: vi.fn().mockReturnThis() };
    const outline = {
      setStrokeStyle: vi.fn().mockReturnThis(),
      setFillStyle: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis()
    };
    const text = { setOrigin: vi.fn().mockReturnThis(), setText: vi.fn().mockReturnThis(), setBackgroundColor: vi.fn().mockReturnThis() };
    const container = {
      setSize: vi.fn().mockReturnThis(),
      setInteractive: vi.fn().mockReturnThis(),
      on: vi.fn()
    };
    scene.add = {
      rectangle: vi.fn().mockReturnValue(outline),
      sprite: vi.fn().mockReturnValue(sprite),
      text: vi.fn().mockReturnValue(text),
      container: vi.fn().mockReturnValue(container)
    } as unknown as typeof scene.add;

    scene.updateAgents([{ id: 'tester', name: 'Tester', role: 'Tester', status: 'working', zone: 'desk' }]);

    expect(scene.add.sprite).toHaveBeenCalledWith(0, 0, 'agent-tester', 0);
    expect(sprite.setFrame).toHaveBeenCalledWith(1);
    expect(scene.add.rectangle).toHaveBeenCalledWith(0, -36, 56, 80);
    expect(container.setSize).toHaveBeenCalledWith(64, 108);
    scene.setSelectedAgent('tester');
    expect(outline.setVisible).toHaveBeenLastCalledWith(true);
  });
});
