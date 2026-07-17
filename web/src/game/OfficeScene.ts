import Phaser from 'phaser';
import { toCanvasPosition } from './positions.js';
import { officeAssetManifest, officeCanvas } from './office-assets.js';
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
  body: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
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

export class OfficeScene extends Phaser.Scene {
  private readonly onAgentSelected: (agentId: string) => void;
  private readonly onEmptyDeskSelected?: () => void;
  private readonly views = new Map<string, AgentView>();
  private pendingAgents: OfficeAgent[] = [];

  constructor(onAgentSelected: (agentId: string) => void, onEmptyDeskSelected?: () => void) {
    super({ key: 'OfficeScene' });
    this.onAgentSelected = onAgentSelected;
    this.onEmptyDeskSelected = onEmptyDeskSelected;
  }

  preload(): void {
    this.load.image('office-background', officeAssetManifest.background);
    this.load.image('agent-builder', officeAssetManifest.agents.builder);
    this.load.image('agent-tester', officeAssetManifest.agents.tester);
    this.load.image('agent-documenter', officeAssetManifest.agents.documenter);
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
      const existing = this.views.get(agent.id);

      if (!existing) {
        const body = this.add.circle(0, 0, 18, color).setStrokeStyle(2, 0xffffff, 0.9);
        const label = this.add.text(0, 28, agent.name, {
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          align: 'center'
        }).setOrigin(0.5, 0);
        const container = this.add.container(target.x, target.y, [body, label]);
        container.setSize(42, 62).setInteractive({ useHandCursor: true });
        container.on('pointerup', () => this.onAgentSelected(agent.id));
        this.views.set(agent.id, { container, body, label });
      } else {
        existing.body.setFillStyle(color);
        existing.label.setText(agent.name);
        this.tweens.add({
          targets: existing.container,
          x: target.x,
          y: target.y,
          duration: 350,
          ease: 'Sine.easeOut'
        });
      }
    }
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
