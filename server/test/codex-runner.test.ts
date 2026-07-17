import { expect, it, vi } from 'vitest';
import { CodexRunner } from '../codex-runner.js';

it('runs Codex inside its assigned workspace and reports completion', async () => {
  const execute = vi.fn().mockResolvedValue({ code: 0, stdout: 'implemented', stderr: '' });
  const emit = vi.fn();
  const runner = new CodexRunner('a1', 'C:/tmp/agent-a1', execute, emit);

  await runner.runNext();

  expect(execute).toHaveBeenCalledWith({
    command: 'codex',
    args: ['exec', 'Implement the assigned bounded task. Run tests and report changed files.'],
    cwd: 'C:/tmp/agent-a1'
  });
  expect(emit).toHaveBeenNthCalledWith(1, {
    agentId: 'a1',
    status: 'working',
    checkpoint: 'implement'
  });
  expect(emit).toHaveBeenNthCalledWith(2, {
    agentId: 'a1',
    status: 'idle',
    message: 'implemented'
  });
});

it('reports an actionable error when Codex exits unsuccessfully', async () => {
  const execute = vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'tests failed' });
  const emit = vi.fn();
  const runner = new CodexRunner('a1', 'C:/tmp/agent-a1', execute, emit);

  await runner.runNext();

  expect(emit).toHaveBeenLastCalledWith({
    agentId: 'a1',
    status: 'error',
    message: 'tests failed'
  });
});
