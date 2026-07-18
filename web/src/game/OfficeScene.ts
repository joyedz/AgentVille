import Phaser from 'phaser';
import { toCanvasPosition, zoneSeatCount } from './positions.js';
import { officeAssetManifest, officeCanvas } from './office-assets.js';
import {
  animationStateForStatus,
  directionForMovement,
  hairAtlasForRole,
  resolveCharacterAnimation,
  validateCharacterManifest,
} from './character-animation.js';
import type { CharacterFacing, CharacterManifest } from './character-animation.js';
import type { Zone } from '../../../server/protocol.js';

export type OfficeAgent = {
  id: string;
  name: string;
  role?: string;
  status: string;
  zone: Zone;
  currentTaskId?: string;
  checkpoint?: string;
  summary?: string;
};

type AgentView = {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  hair: Phaser.GameObjects.Sprite;
  outline: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  marker: Phaser.GameObjects.Text;
  target: { x: number; y: number };
  motionTween: Phaser.Tweens.Tween | null;
  motionGeneration: number;
  hairTexture: string;
  statusState: string;
  previousAgent: OfficeAgent;
  transitionState: string | null;
  pendingTransitionState: string | null;
  activeAnimation: string | null;
  lastFacing: CharacterFacing;
};

const zoneColors: Record<Zone, number> = {
  desk: 0x2563eb,
  coffee: 0xd97706,
  lounge: 0x7c3aed,
  attention: 0xdc2626
};

const statusColors: Record<string, number> = {
  working: 0x38bdf8,
  idle: 0x94a3b8,
  blocked: 0xfbbf24,
  error: 0xf87171,
  paused: 0xa78bfa,
  stopped: 0x64748b
};

const backgroundDepth = 0;
const agentDepth = 2;
const characterSheet = { frameWidth: 32, frameHeight: 32 };
const characterHairTextures = ['hair-short', 'hair-swept', 'hair-curly'];

function statusStateForAgent(agent: OfficeAgent): string {
  const checkpoint = agent.checkpoint?.trim().toLowerCase();
  if (agent.status === 'working' && checkpoint === 'inspect') return 'inspecting';
  if (agent.status === 'working' && checkpoint === 'planning') return 'planning';
  return animationStateForStatus(agent.status);
}

function transitionStateForAgent(previous: OfficeAgent, next: OfficeAgent): string | undefined {
  if (next.currentTaskId && next.currentTaskId !== previous.currentTaskId) return 'starting';
  if (previous.status === 'blocked' && next.status === 'working') return 'completed';
  if (previous.status === 'working' && next.status === 'idle') return 'completed';
  return undefined;
}

function toHexColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export class OfficeScene extends Phaser.Scene {
  private readonly onAgentSelected: (agentId: string) => void;
  private readonly views = new Map<string, AgentView>();
  private pendingAgents: OfficeAgent[] = [];
  private selectedAgentId: string | null = null;
  private characterManifest: CharacterManifest | null = null;

  constructor(onAgentSelected: (agentId: string) => void) {
    super({ key: 'OfficeScene' });
    this.onAgentSelected = onAgentSelected;
  }

  preload(): void {
    this.load.image('office-background', officeAssetManifest.background);
    this.load.json('character-manifest', '/assets/characters/manifest.json');
    this.load.spritesheet('character-body', '/assets/characters/body.png', characterSheet);
    for (const hairTexture of characterHairTextures) {
      this.load.spritesheet(hairTexture, `/assets/characters/${hairTexture}.png`, characterSheet);
    }
    this.load.image('office-status-markers', officeAssetManifest.markers);
    this.load.image('office-props', officeAssetManifest.props);
    this.load.image('office-nameplates', officeAssetManifest.nameplates);
  }

  create(): void {
    this.add.image(officeCanvas.width / 2, officeCanvas.height / 2, 'office-background')
      .setOrigin(0.5)
      .setDepth(backgroundDepth);
    this.drawOffice();
    this.ensureCharacterAnimations();
    this.updateAgents(this.pendingAgents);
  }

  updateAgents(agents: OfficeAgent[]): void {
    this.pendingAgents = agents.map((agent) => ({ ...agent }));
    if (!this.add) return;
    this.ensureCharacterAnimations();

    const activeIds = new Set(agents.map((agent) => agent.id));
    for (const [id, view] of this.views) {
      if (!activeIds.has(id)) {
        this.stopAgentMotion(view);
        view.container.destroy();
        this.views.delete(id);
      }
    }

    const ordered = [...agents].sort((a, b) => a.id.localeCompare(b.id));
    // Desks are personal: each agent keeps a stable home seat based on its
    // position in the full roster, so an assignment fills an empty desk instead
    // of displacing a coworker.
    const homeSeat = new Map<string, number>();
    ordered.forEach((agent, index) => homeSeat.set(agent.id, index));
    // The break areas are transient, so occupants are packed into distinct
    // seats; a full lounge spills into the otherwise-empty coffee area so agents
    // never stack on top of each other.
    const zoneUsage = new Map<Zone, number>();
    const nextSeat = (zone: Zone): number => {
      const used = zoneUsage.get(zone) ?? 0;
      zoneUsage.set(zone, used + 1);
      return used;
    };
    const seatFor = (agent: OfficeAgent): { x: number; y: number } => {
      if (agent.zone === 'desk') return toCanvasPosition('desk', homeSeat.get(agent.id) ?? 0);
      if (agent.zone === 'lounge') {
        const used = nextSeat('lounge');
        if (used < zoneSeatCount('lounge')) return toCanvasPosition('lounge', used);
        return toCanvasPosition('coffee', nextSeat('coffee'));
      }
      return toCanvasPosition(agent.zone, nextSeat(agent.zone));
    };
    for (const agent of ordered) {
      const target = seatFor(agent);
      const color = statusColors[agent.status] ?? zoneColors[agent.zone];
      const hairTexture = hairAtlasForRole(agent.role);
      const statusState = statusStateForAgent(agent);
      const existing = this.views.get(agent.id);

      if (!existing) {
        const outline = this.add.rectangle(0, -54, 84, 116)
          .setStrokeStyle(2, 0xfacc15, 1)
          .setFillStyle(0x000000, 0)
          .setVisible(this.selectedAgentId === agent.id);
        const body = this.add.sprite(0, 0, 'character-body', 0)
          .setOrigin(0.5, 0.875)
          .setScale(2);
        const hair = this.add.sprite(0, 0, hairTexture, 0)
          .setOrigin(0.5, 0.875)
          .setScale(2);
        const label = this.add.text(0, -122, agent.name, {
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          backgroundColor: '#0f172acc',
          padding: { left: 4, right: 4, top: 2, bottom: 2 },
          align: 'center'
        }).setOrigin(0.5, 1);
        const marker = this.add.text(0, -145, agent.status.toUpperCase(), {
          color: '#0f172a',
          backgroundColor: toHexColor(color),
          fontFamily: 'monospace',
          fontSize: '8px',
          fontStyle: 'bold',
          padding: { left: 4, right: 4, top: 2, bottom: 2 },
          align: 'center'
        }).setOrigin(0.5, 1);
        // Child order deliberately keeps the text UI above this agent's sprite.
        const container = this.add.container(target.x, target.y, [outline, body, hair, label, marker]);
        container.setSize(96, 148).setInteractive({ useHandCursor: true }).setDepth(agentDepth);
        container.on('pointerup', () => this.onAgentSelected(agent.id));
        this.views.set(agent.id, {
          container,
          body,
          outline,
          label,
          marker,
          hair,
          target,
          motionTween: null,
          motionGeneration: 0,
          hairTexture,
          statusState,
          previousAgent: { ...agent },
          transitionState: null,
          pendingTransitionState: null,
          activeAnimation: null,
          lastFacing: 'down'
        });
        this.playCharacterAnimation(this.views.get(agent.id)!, statusState);
      } else {
        const targetChanged = existing.target.x !== target.x || existing.target.y !== target.y;
        const hairChanged = existing.hairTexture !== hairTexture;
        if (hairChanged) {
          existing.hair.setTexture(hairTexture);
          existing.hairTexture = hairTexture;
          existing.activeAnimation = null;
        }
        const transitionState = transitionStateForAgent(existing.previousAgent, agent);
        existing.previousAgent = { ...agent };
        existing.statusState = statusState;
        if (transitionState && (targetChanged || existing.motionTween)) {
          existing.pendingTransitionState = transitionState;
        } else if (transitionState && !existing.motionTween) {
          this.playTransitionAnimation(existing, transitionState);
        } else if (!existing.motionTween && !existing.transitionState && !existing.pendingTransitionState) {
          this.playCharacterAnimation(existing, statusState);
        }
        existing.label.setText(agent.name);
        existing.marker.setText(agent.status.toUpperCase());
        existing.marker.setBackgroundColor(toHexColor(color));
        existing.outline.setVisible(this.selectedAgentId === agent.id);
        if (targetChanged) this.startAgentMotion(existing, target);
      }
    }
  }

  /** Keep selection rendering in the scene so React only owns the selected id. */
  setSelectedAgent(agentId: string | null): void {
    this.selectedAgentId = agentId;
    for (const [id, view] of this.views) view.outline.setVisible(id === agentId);
  }

  private startAgentMotion(view: AgentView, target: { x: number; y: number }): void {
    // Retargeting first cancels the old tween and restores the current status.
    this.stopAgentMotion(view, false);
    const previousTarget = view.target;
    view.target = target;
    const motionGeneration = view.motionGeneration;
    view.lastFacing = directionForMovement(previousTarget, target, view.lastFacing);
    this.playCharacterAnimation(view, 'moving', view.lastFacing);
    view.motionTween = this.tweens.add({
      targets: view.container,
      x: target.x,
      y: target.y,
      duration: 360,
      ease: 'Sine.easeOut',
      onComplete: () => this.finishAgentMotion(view, motionGeneration),
      onStop: () => this.finishAgentMotion(view, motionGeneration)
    });
  }

  private finishAgentMotion(view: AgentView, motionGeneration: number): void {
    if (view.motionGeneration !== motionGeneration) return;
    this.stopAgentMotion(view);
  }

  private stopAgentMotion(view: AgentView, restoreAnimation = true): void {
    const tween = view.motionTween;
    view.motionTween = null;
    // Invalidate callbacks before stopping a Phaser tween, which can emit onStop.
    view.motionGeneration += 1;
    tween?.stop();
    if (!restoreAnimation) return;
    const transitionState = view.pendingTransitionState;
    view.pendingTransitionState = null;
    if (transitionState) {
      this.playTransitionAnimation(view, transitionState);
    } else if (!view.transitionState) {
      this.playCharacterAnimation(view, view.statusState);
    }
  }

  private ensureCharacterAnimations(): void {
    if (this.characterManifest) return;
    const manifest = this.cache.json.get('character-manifest') as CharacterManifest;
    const validationErrors = validateCharacterManifest(manifest);
    if (validationErrors.length) throw new Error(`Invalid character manifest: ${validationErrors.join(' ')}`);
    this.characterManifest = manifest;
    for (const animation of manifest.animations) {
      for (const texture of ['character-body', ...characterHairTextures]) {
        const key = `${texture}-${animation.name}`;
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(texture, { start: animation.start, end: animation.start + animation.frames - 1 }),
          frameRate: animation.fps,
          repeat: animation.loop ? -1 : 0
        });
      }
    }
  }

  private playCharacterAnimation(view: AgentView, state: string, facing = view.lastFacing): void {
    const animation = resolveCharacterAnimation(this.characterManifest!, state, facing);
    if (view.activeAnimation === animation.name) return;
    view.activeAnimation = animation.name;
    view.body.play(`character-body-${animation.name}`);
    view.hair.play(`${view.hairTexture}-${animation.name}`);
  }

  private playTransitionAnimation(view: AgentView, state: string): void {
    if (view.transitionState) return;
    view.transitionState = state;
    view.activeAnimation = null;
    this.playCharacterAnimation(view, state);
    view.body.once('animationcomplete', () => {
      if (view.transitionState !== state) return;
      view.transitionState = null;
      view.activeAnimation = null;
      if (!view.motionTween) this.playCharacterAnimation(view, view.statusState);
    });
  }

  private drawOffice(): void {
    this.cameras.main.setBackgroundColor('#0f172a');
    // The pixel-art background owns the room composition; agents are the only
    // interactive objects, so there is no invisible hit zone over the map.
    this.events.once('shutdown', () => {
      for (const view of this.views.values()) this.stopAgentMotion(view);
    });
  }
}

export function createOfficeGame(
  parent: HTMLElement,
  onAgentSelected: (agentId: string) => void
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: officeCanvas.width,
    height: officeCanvas.height,
    parent,
    backgroundColor: '#0f172a',
    render: { antialias: false, pixelArt: true },
    scene: new OfficeScene(onAgentSelected),
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
  });
}
