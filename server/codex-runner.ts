import type { CommandType } from './protocol.js';
import type { Runner, RunnerAcceptResult, RunnerEvent } from './runner.js';

export type ProcessResult = { code: number; stdout: string; stderr: string };
export type ProcessExecutor = (input: { command: string; args: string[]; cwd: string; signal?: AbortSignal }) => Promise<ProcessResult>;

function outputMetadata(output: string): Pick<RunnerEvent, 'changedFiles' | 'logTail' | 'summary'> {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const changedLine = lines.find((line) => line.startsWith('CHANGED_FILES:'));
  const summaryLine = lines.find((line) => line.startsWith('TEST_RESULT:'));
  const metadata: Pick<RunnerEvent, 'changedFiles' | 'logTail' | 'summary'> = { logTail: lines.slice(-20) };
  if (changedLine) metadata.changedFiles = changedLine.slice('CHANGED_FILES:'.length).split(',').map((file) => file.trim()).filter(Boolean);
  if (summaryLine) metadata.summary = summaryLine.slice('TEST_RESULT:'.length).trim() || undefined;
  return metadata;
}

export class CodexRunner {
  private working = false;
  private executing = false;
  private paused = false;
  private stopped = false;
  private resumeRequested = false;
  private activeAbortController?: AbortController;
  private taskTitle?: string;
  private currentTaskId?: string;
  private readonly instructions: string[] = [];

  constructor(
    private readonly agentId: string,
    private readonly cwd: string,
    private readonly execute: ProcessExecutor,
    private readonly emit: (event: RunnerEvent) => void,
    initialStatus?: string
  ) {
    // Keep a recreated runner consistent with the persisted agent status so an
    // assignment is not rejected by stale in-memory flags after a restart.
    if (initialStatus === 'paused') this.paused = true;
    else if (initialStatus === 'working') this.working = true;
    else if (initialStatus === 'stopped') this.stopped = true;
  }

  async runNext() {
    if (this.stopped || this.paused || this.executing) return;
    this.executing = true;
    this.working = true;
    const abortController = new AbortController();
    this.activeAbortController = abortController;
    this.emit({ agentId: this.agentId, status: 'working', currentTaskId: this.currentTaskId, checkpoint: 'implement' });

    try {
      const prompt = [
        'Implement the assigned bounded task. Run tests and report changed files.',
        this.taskTitle ? `Assigned task: ${this.taskTitle}` : undefined,
        ...this.instructions.splice(0)
      ].filter(Boolean).join('\n');
      const result = await this.execute({
        command: process.env.CODEX_BIN ?? 'codex',
        args: ['exec', prompt],
        cwd: this.cwd,
        signal: abortController.signal
      });
      if (this.stopped && abortController.signal.aborted) return;
      const message =
        result.stderr ||
        result.stdout ||
        (result.code === 0 ? 'Codex completed successfully.' : `Codex exited with code ${result.code}.`);
      const metadata = outputMetadata([result.stdout, result.stderr].filter(Boolean).join('\n'));
      this.emit({
        agentId: this.agentId,
        currentTaskId: this.currentTaskId,
        status: this.stopped ? 'stopped' : this.paused ? 'paused' : result.code === 0 ? 'idle' : 'error',
        message,
        ...metadata
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit({ agentId: this.agentId, currentTaskId: this.currentTaskId, status: 'error', message });
    } finally {
      const shouldResume = this.resumeRequested && !this.stopped;
      this.resumeRequested = false;
      this.executing = false;
      this.working = false;
      if (this.activeAbortController === abortController) this.activeAbortController = undefined;
      if (shouldResume) queueMicrotask(() => void this.runNext());
    }
  }

  async accept(command: { id?: string; type: CommandType; payload?: unknown }): Promise<RunnerAcceptResult> {
    const payload = command.payload && typeof command.payload === 'object' ? command.payload as Record<string, unknown> : {};
    switch (command.type) {
      case 'pause':
        if (!this.working || this.stopped) return { ok: false, error: 'pause is not valid in the current state' };
        this.paused = true;
        this.working = false;
        this.emit({ agentId: this.agentId, currentTaskId: this.currentTaskId, status: 'paused', checkpoint: 'implement', message: 'paused at checkpoint' });
        return { ok: true };
      case 'resume':
        if (this.stopped || !this.paused) return { ok: false, error: 'resume is only valid while paused' };
        this.paused = false;
        if (this.executing) {
          this.resumeRequested = true;
          this.emit({ agentId: this.agentId, currentTaskId: this.currentTaskId, status: 'working', checkpoint: 'implement' });
        } else {
          void this.runNext();
        }
        return { ok: true };
      case 'stop':
        if (this.stopped) return { ok: false, error: 'runner is already stopped' };
        this.stopped = true;
        this.paused = false;
        this.working = false;
        this.activeAbortController?.abort();
        this.emit({ agentId: this.agentId, currentTaskId: this.currentTaskId, status: 'stopped', checkpoint: 'implement', message: 'stopped' });
        return { ok: true, message: 'stopped' };
      case 'assign_task': {
        const taskTitle = payload.taskTitle;
        if (typeof taskTitle !== 'string' || !taskTitle.trim()) return { ok: false, error: 'taskTitle is required' };
        if (this.working || this.paused || this.executing) return { ok: false, error: 'assign_task is only valid while idle' };
        this.stopped = false;
        this.taskTitle = taskTitle.trim();
        this.currentTaskId = command.id ?? taskTitle.trim();
        return { ok: true };
      }
      case 'add_instruction': {
        const instruction = payload.instruction;
        if (typeof instruction !== 'string' || !instruction.trim()) return { ok: false, error: 'instruction is required' };
        if (this.stopped) return { ok: false, error: 'runner is stopped' };
        this.instructions.push(instruction.trim());
        return { ok: true };
      }
      case 'approve':
        return { ok: false, error: 'approve is not supported by the Codex runner' };
      default:
        return { ok: false, error: `unsupported command: ${String(command.type)}` };
    }
  }
}
