import Phaser from 'phaser';
import { toCanvasPosition } from './positions.js';
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
  private readonly views = new Map<string, AgentView>();
  private pendingAgents: OfficeAgent[] = [];

  constructor(onAgentSelected: (agentId: string) => void) {
    super({ key: 'OfficeScene' });
    this.onAgentSelected = onAgentSelected;
  }

  create(): void {
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
    const graphics = this.add.graphics();
    graphics.fillStyle(0x172554, 1).fillRoundedRect(25, 35, 510, 325, 18);
    graphics.fillStyle(0x431407, 1).fillRoundedRect(35, 405, 205, 145, 18);
    graphics.fillStyle(0x2e1065, 1).fillRoundedRect(270, 405, 300, 145, 18);
    graphics.fillStyle(0x450a0a, 1).fillRoundedRect(620, 35, 245, 180, 18);
    graphics.lineStyle(1, 0x334155, 0.8).strokeRoundedRect(25, 35, 510, 325, 18);
    graphics.strokeRoundedRect(35, 405, 205, 145, 18);
    graphics.strokeRoundedRect(270, 405, 300, 145, 18);
    graphics.strokeRoundedRect(620, 35, 245, 180, 18);

    this.add.text(48, 52, 'DESK', this.headingStyle());
    this.add.text(52, 420, 'COFFEE', this.headingStyle());
    this.add.text(287, 420, 'LOUNGE', this.headingStyle());
    this.add.text(638, 50, 'ATTENTION', this.headingStyle());
    this.add.text(48, 83, 'Focused workstations', { color: '#93c5fd', fontSize: '13px' });
    this.add.text(52, 451, 'Reset and recharge', { color: '#fdba74', fontSize: '13px' });
    this.add.text(287, 451, 'Shared space', { color: '#d8b4fe', fontSize: '13px' });
    this.add.text(638, 81, 'Needs a human', { color: '#fca5a5', fontSize: '13px' });
  }

  private headingStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: '#f8fafc',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold'
    };
  }
}

export function createOfficeGame(
  parent: HTMLElement,
  onAgentSelected: (agentId: string) => void
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 900,
    height: 600,
    parent,
    backgroundColor: '#0f172a',
    render: { antialias: true, pixelArt: false },
    scene: new OfficeScene(onAgentSelected),
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
  });
}
