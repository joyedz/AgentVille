type ProcessResult = { code: number; stdout: string; stderr: string };
type Execute = (input: { command: string; args: string[]; cwd: string }) => Promise<ProcessResult>;

const CODEX_ARGS = [
  'exec',
  'Implement the assigned bounded task. Run tests and report changed files.'
];

export class CodexRunner {
  constructor(
    private readonly agentId: string,
    private readonly cwd: string,
    private readonly execute: Execute,
    private readonly emit: (event: unknown) => void
  ) {}

  async runNext() {
    this.emit({ agentId: this.agentId, status: 'working', checkpoint: 'implement' });

    try {
      const result = await this.execute({
        command: process.env.CODEX_BIN ?? 'codex',
        args: CODEX_ARGS,
        cwd: this.cwd
      });
      const message =
        result.stderr ||
        result.stdout ||
        (result.code === 0 ? 'Codex completed successfully.' : `Codex exited with code ${result.code}.`);
      this.emit({
        agentId: this.agentId,
        status: result.code === 0 ? 'idle' : 'error',
        message
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit({ agentId: this.agentId, status: 'error', message });
    }
  }
}
