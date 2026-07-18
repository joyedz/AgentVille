import Phaser from 'phaser';
import { toCanvasPosition, zoneSeatCount } from './positions.js';
import { agentPresentation, agentSprite, officeAssetManifest, officeCanvas } from './office-assets.js';
import type { Zone } from '../../../server/protocol.js';

export type OfficeAgent = {
  id: string;
  name: string;
  role?: string;
  status: string;
  zone: Zone;
};

type AgentView = {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  outline: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  marker: Phaser.GameObjects.Text;
  target: { x: number; y: number };
  walkTimer: Phaser.Time.TimerEvent | null;
  walkFrameIndex: number;
  statusFrame: number;
  motionTween: Phaser.Tweens.Tween | null;
  motionGeneration: number;
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

// Stationary status frames precede the four walk-only frames in every sheet.
const statusFrames: Record<string, number> = {
  idle: 0,
  stopped: 0,
  working: 1,
  blocked: 2,
  error: 2,
  paused: 3
};

const backgroundDepth = 0;
const agentDepth = 2;

function textureForRole(role: string | undefined, id: string): string {
  const value = `${role ?? ''} ${id}`.toLowerCase();
  if (value.includes('tester') || value.includes('test')) return 'agent-tester';
  if (value.includes('documenter') || value.includes('docs') || value.includes('writer')) return 'agent-documenter';
  return 'agent-builder';
}

function toHexColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export class OfficeScene extends Phaser.Scene {
  private readonly onAgentSelected: (agentId: string) => void;
  private readonly views = new Map<string, AgentView>();
  private pendingAgents: OfficeAgent[] = [];
  private selectedAgentId: string | null = null;

  constructor(onAgentSelected: (agentId: string) => void) {
    super({ key: 'OfficeScene' });
    this.onAgentSelected = onAgentSelected;
  }

  preload(): void {
    this.load.image('office-background', officeAssetManifest.background);
    this.load.spritesheet('agent-builder', officeAssetManifest.agents.builder, agentSprite);
    this.load.spritesheet('agent-tester', officeAssetManifest.agents.tester, agentSprite);
    this.load.spritesheet('agent-documenter', officeAssetManifest.agents.documenter, agentSprite);
    this.load.image('office-status-markers', officeAssetManifest.markers);
    this.load.image('office-props', officeAssetManifest.props);
    this.load.image('office-nameplates', officeAssetManifest.nameplates);
  }

  create(): void {
    this.add.image(officeCanvas.width / 2, officeCanvas.height / 2, 'office-background')
      .setOrigin(0.5)
      .setDepth(backgroundDepth);
    this.drawOffice();
    this.updateAgents(this.pendingAgents);
  }

  updateAgents(agents: OfficeAgent[]): void {
    this.pendingAgents = agents.map((agent) => ({ ...agent }));
    if (!this.add) return;

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
      const texture = textureForRole(agent.role, agent.id);
      const frame = statusFrames[agent.status] ?? 0;
      const existing = this.views.get(agent.id);

      if (!existing) {
        const outline = this.add.rectangle(0, -54, 84, 116)
          .setStrokeStyle(2, 0xfacc15, 1)
          .setFillStyle(0x000000, 0)
          .setVisible(this.selectedAgentId === agent.id);
        const body = this.add.sprite(0, 0, texture, 0)
          .setOrigin(0.5, 1)
          .setScale(agentPresentation.scale)
          .setFrame(frame);
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
        const container = this.add.container(target.x, target.y, [outline, body, label, marker]);
        container.setSize(96, 148).setInteractive({ useHandCursor: true }).setDepth(agentDepth);
        container.on('pointerup', () => this.onAgentSelected(agent.id));
        this.views.set(agent.id, {
          container,
          body,
          outline,
          label,
          marker,
          target,
          walkTimer: null,
          walkFrameIndex: 0,
          statusFrame: frame,
          motionTween: null,
          motionGeneration: 0
        });
      } else {
        const targetChanged = existing.target.x !== target.x || existing.target.y !== target.y;
        existing.body.setTexture(texture);
        existing.statusFrame = frame;
        if (!existing.walkTimer) existing.body.setFrame(frame);
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
    // Retargeting first cancels the old timer/tween and restores the current status.
    this.stopAgentMotion(view);
    view.target = target;
    const motionGeneration = view.motionGeneration;
    view.walkFrameIndex = 1;
    view.body.setFrame(agentPresentation.walkFrames[0]);
    view.walkTimer = this.time.addEvent({
      delay: agentPresentation.frameDurationMs,
      loop: true,
      callback: () => {
        view.body.setFrame(agentPresentation.walkFrames[view.walkFrameIndex]);
        view.walkFrameIndex = (view.walkFrameIndex + 1) % agentPresentation.walkFrames.length;
      }
    });
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

  private stopAgentMotion(view: AgentView): void {
    const timer = view.walkTimer;
    const tween = view.motionTween;
    view.walkTimer = null;
    view.motionTween = null;
    view.walkFrameIndex = 0;
    // Invalidate callbacks before stopping a Phaser tween, which can emit onStop.
    view.motionGeneration += 1;
    timer?.remove();
    tween?.stop();
    view.body.setFrame(view.statusFrame);
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
