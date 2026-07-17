import Phaser from 'phaser';
import { toCanvasPosition } from './positions.js';
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

// Agent sheets contain idle, working, blocked, and paused frames in that order.
const statusFrames: Record<string, number> = {
  idle: 0,
  stopped: 0,
  working: 1,
  blocked: 2,
  error: 2,
  paused: 3
};

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
  private readonly onEmptyDeskSelected?: () => void;
  private readonly views = new Map<string, AgentView>();
  private pendingAgents: OfficeAgent[] = [];
  private selectedAgentId: string | null = null;

  constructor(onAgentSelected: (agentId: string) => void, onEmptyDeskSelected?: () => void) {
    super({ key: 'OfficeScene' });
    this.onAgentSelected = onAgentSelected;
    this.onEmptyDeskSelected = onEmptyDeskSelected;
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
    this.add.image(officeCanvas.width / 2, officeCanvas.height / 2, 'office-background').setOrigin(0.5);
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

    const slots = new Map<Zone, number>();
    const ordered = [...agents].sort((a, b) => a.id.localeCompare(b.id));
    for (const agent of ordered) {
      const slot = slots.get(agent.zone) ?? 0;
      slots.set(agent.zone, slot + 1);
      const target = toCanvasPosition(agent.zone, slot);
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
        const container = this.add.container(target.x, target.y, [outline, body, label, marker]);
        container.setSize(96, 148).setInteractive({ useHandCursor: true });
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
          statusFrame: frame
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
        if (targetChanged) {
          this.stopAgentMotion(existing);
          existing.target = target;
          existing.walkFrameIndex = 0;
          existing.walkTimer = this.time.addEvent({
            delay: agentPresentation.frameDurationMs,
            loop: true,
            callback: () => {
              existing.body.setFrame(agentPresentation.walkFrames[existing.walkFrameIndex]);
              existing.walkFrameIndex = (existing.walkFrameIndex + 1) % agentPresentation.walkFrames.length;
            }
          });
          this.tweens.add({
            targets: existing.container,
            x: target.x,
            y: target.y,
            duration: 350,
            ease: 'Sine.easeOut',
            onComplete: () => {
              this.stopAgentMotion(existing);
              existing.body.setFrame(existing.statusFrame);
            }
          });
        }
      }
    }
  }

  /** Keep selection rendering in the scene so React only owns the selected id. */
  setSelectedAgent(agentId: string | null): void {
    this.selectedAgentId = agentId;
    for (const [id, view] of this.views) view.outline.setVisible(id === agentId);
  }

  private stopAgentMotion(view: AgentView): void {
    view.walkTimer?.remove();
    view.walkTimer = null;
    view.walkFrameIndex = 0;
  }

  private drawOffice(): void {
    this.cameras.main.setBackgroundColor('#0f172a');
    // The pixel-art background owns the room composition. Keep only the
    // interactive empty-desk hit area from the previous drawn layout.
    if (!this.onEmptyDeskSelected || typeof this.add.zone !== 'function') return;

    const deskHitArea = this.add.zone(280, 230, 460, 235)
      .setInteractive({ useHandCursor: true })
      .setDepth(-1);
    deskHitArea.on('pointerup', this.onEmptyDeskSelected);
    this.input.keyboard?.on('keydown-D', this.onEmptyDeskSelected);
    this.events.once('shutdown', () => {
      deskHitArea.destroy();
      this.input.keyboard?.off('keydown-D', this.onEmptyDeskSelected);
    });
  }
}

export function createOfficeGame(
  parent: HTMLElement,
  onAgentSelected: (agentId: string) => void,
  onEmptyDeskSelected?: () => void
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: officeCanvas.width,
    height: officeCanvas.height,
    parent,
    backgroundColor: '#0f172a',
    render: { antialias: false, pixelArt: true },
    scene: new OfficeScene(onAgentSelected, onEmptyDeskSelected),
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
  });
}
