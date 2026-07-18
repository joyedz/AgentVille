import type { CommandType } from './protocol.js';
import type { Runner, RunnerAcceptResult, RunnerEvent } from './runner.js';

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
  private working = false;
  private readonly instructions: string[] = [];
  private nextTaskTitle?: string;
  private currentTaskId?: string;

  constructor(
    private readonly agentId: string,
    private readonly emit: Emit,
    private readonly checkpoints: string[],
    initialStatus?: string
  ) {
    // Align internal state with a persisted/recovered agent status so a runner
    // recreated on restart agrees with the stored status (e.g. a 'stopped'
    // agent stays assignable instead of looking like a fresh mid-plan runner).
    switch (initialStatus) {
      case 'stopped':
        this.stopped = true;
        break;
      case 'paused':
        this.paused = true;
        break;
      case 'blocked':
        this.blocked = true;
        break;
      case 'working':
        this.working = true;
        break;
      case 'idle':
      case 'error':
        this.index = checkpoints.length;
        break;
      default:
        break;
    }
  }

  async runNext(): Promise<void> {
    if (this.stopped || this.paused) return;
    if (this.blocked) {
      this.working = false;
      this.emitEvent('blocked', this.currentCheckpoint(), 'approval required');
      return;
    }
    if (this.nextTaskTitle) {
      const assignedTask = this.nextTaskTitle;
      this.nextTaskTitle = undefined;
      this.emitWorking(assignedTask);
      return;
    }
    if (this.index + 1 >= this.checkpoints.length) {
      this.working = false;
      this.emitEvent('idle', this.currentCheckpoint(), undefined, 'task complete');
      return;
    }

    this.index += 1;
    const checkpoint = this.currentCheckpoint();
    if (checkpoint === 'approval') {
      this.blocked = true;
      this.working = false;
      this.emitEvent('blocked', checkpoint, 'approval required');
      return;
    }

    this.emitWorking(checkpoint);
  }

  async accept(command: { id?: string; type: CommandType; payload?: unknown }): Promise<RunnerAcceptResult> {
    const payload = payloadObject(command.payload);
    switch (command.type) {
      case 'approve':
        if (!this.blocked || this.stopped || this.paused) return this.failure('approve is only valid while blocked');
        this.blocked = false;
        if (this.index + 1 < this.checkpoints.length) this.index += 1;
        this.emitWorking(this.currentCheckpoint());
        return this.success();
      case 'pause':
        if (!this.working) return this.failure('pause is not valid in the current state');
        this.paused = true;
        this.working = false;
        this.emitEvent('paused', this.currentCheckpoint());
        return this.success();
      case 'resume':
        if (this.stopped || !this.paused) return this.failure('resume is only valid while paused');
        this.paused = false;
        this.emitWorking(this.currentCheckpoint());
        return this.success();
      case 'stop':
        if (this.stopped) return this.failure('runner is already stopped');
        this.stopped = true;
        this.paused = false;
        this.blocked = false;
        this.working = false;
        this.emitEvent('stopped', this.currentCheckpoint(), 'stopped');
        return this.success('stopped');
      case 'add_instruction': {
        const instruction = payload.instruction;
        if (typeof instruction !== 'string' || !instruction.trim()) return this.failure('instruction is required');
        if (this.stopped) return this.failure('runner is stopped');
        this.instructions.push(instruction.trim());
        return this.success();
      }
      case 'assign_task': {
        const taskTitle = payload.taskTitle;
        if (typeof taskTitle !== 'string' || !taskTitle.trim()) return this.failure('taskTitle is required');
        if (!this.canAssignTask()) {
          return this.failure('assign_task is only valid while idle, stopped, or completed');
        }
        this.index = -1;
        this.blocked = false;
        this.paused = false;
        this.stopped = false;
        this.working = false;
        this.nextTaskTitle = undefined;
        this.nextTaskTitle = taskTitle.trim();
        this.currentTaskId = command.id ?? taskTitle.trim();
        return this.success();
      }
      default:
        return this.failure(`unsupported command: ${String(command.type)}`);
    }
  }

  private success(message?: string, summary?: string): RunnerAcceptResult {
    return { ok: true, message, summary };
  }

  private failure(error: string, message?: string, summary?: string): RunnerAcceptResult {
    return { ok: false, error, message, summary };
  }

  private currentCheckpoint(): string | undefined {
    return this.nextTaskTitle ?? this.checkpoints[this.index];
  }

  private canAssignTask(): boolean {
    return this.stopped || (
      !this.paused
      && !this.blocked
      && !this.nextTaskTitle
      && this.index + 1 >= this.checkpoints.length
    );
  }

  private emitWorking(checkpoint: string | undefined): void {
    this.working = true;
    const message = this.instructions.length > 0 ? this.instructions.shift() : undefined;
    this.emitEvent('working', checkpoint, message);
  }

  private emitEvent(status: RunnerEvent['status'], checkpoint?: string, message?: string, summary?: string): void {
    this.emit({ agentId: this.agentId, status, currentTaskId: this.currentTaskId, checkpoint, message, summary });
  }
}
