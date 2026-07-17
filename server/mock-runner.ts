import type { CommandType } from './protocol.js';
import type { Runner, RunnerEvent } from './runner.js';

type Emit = (event: RunnerEvent) => void;

function payloadObject(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
}

/** Deterministic runner used by the local control-plane and integration tests. */
export class MockRunner implements Runner {
  private index = -1;
  private paused = false;
  private stopped = false;
  private blocked = false;
  private readonly instructions: string[] = [];
  private nextTaskTitle?: string;

  constructor(
    private readonly agentId: string,
    private readonly emit: Emit,
    private readonly checkpoints: string[]
  ) {}

  async runNext(): Promise<void> {
    if (this.stopped || this.paused) return;
    if (this.blocked) {
      this.emitEvent('blocked', this.currentCheckpoint(), 'approval required');
      return;
    }
    if (this.index + 1 >= this.checkpoints.length) {
      this.emitEvent('idle', this.currentCheckpoint(), undefined, 'task complete');
      return;
    }

    this.index += 1;
    const checkpoint = this.currentCheckpoint();
    if (checkpoint === 'approval') {
      this.blocked = true;
      this.emitEvent('blocked', checkpoint, 'approval required');
      return;
    }

    this.emitWorking(checkpoint);
  }

  async accept(command: { type: CommandType; payload?: unknown }): Promise<void> {
    const payload = payloadObject(command.payload);
    switch (command.type) {
      case 'approve':
        if (!this.blocked || this.stopped || this.paused) return;
        this.blocked = false;
        if (this.index + 1 < this.checkpoints.length) this.index += 1;
        this.emitWorking(this.currentCheckpoint());
        return;
      case 'pause':
        if (this.stopped || this.paused) return;
        this.paused = true;
        this.emitEvent('paused', this.currentCheckpoint());
        return;
      case 'resume':
        if (this.stopped || !this.paused) return;
        this.paused = false;
        this.emitWorking(this.currentCheckpoint());
        return;
      case 'stop':
        if (this.stopped) return;
        this.stopped = true;
        this.paused = false;
        this.blocked = false;
        this.emitEvent('idle', this.currentCheckpoint(), 'stopped');
        return;
      case 'add_instruction': {
        const instruction = payload.instruction;
        if (typeof instruction === 'string' && instruction.trim()) this.instructions.push(instruction.trim());
        return;
      }
      case 'assign_task': {
        const taskTitle = payload.taskTitle;
        if (typeof taskTitle === 'string' && taskTitle.trim()) this.nextTaskTitle = taskTitle.trim();
        return;
      }
    }
  }

  private currentCheckpoint(): string | undefined {
    return this.nextTaskTitle ?? this.checkpoints[this.index];
  }

  private emitWorking(checkpoint: string | undefined): void {
    const message = this.instructions.length > 0 ? this.instructions.shift() : undefined;
    this.emitEvent('working', checkpoint, message);
    this.nextTaskTitle = undefined;
  }

  private emitEvent(status: RunnerEvent['status'], checkpoint?: string, message?: string, summary?: string): void {
    this.emit({ agentId: this.agentId, status, checkpoint, message, summary });
  }
}

