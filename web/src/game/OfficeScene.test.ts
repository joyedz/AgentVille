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
import { officeAssetManifest, officeCanvas } from './office-assets.js';
import { createOfficeGame, OfficeScene } from './OfficeScene.js';

describe('OfficeScene pixel office background', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preloads every office asset from the manifest', () => {
    const scene = new OfficeScene(vi.fn());

    scene.preload();

    expect(scene.load.image).toHaveBeenCalledWith('office-background', officeAssetManifest.background);
    expect(scene.load.spritesheet).toHaveBeenCalledWith('agent-builder', officeAssetManifest.agents.builder, { frameWidth: 32, frameHeight: 48 });
    expect(scene.load.spritesheet).toHaveBeenCalledWith('agent-tester', officeAssetManifest.agents.tester, { frameWidth: 32, frameHeight: 48 });
    expect(scene.load.spritesheet).toHaveBeenCalledWith('agent-documenter', officeAssetManifest.agents.documenter, { frameWidth: 32, frameHeight: 48 });
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
});
