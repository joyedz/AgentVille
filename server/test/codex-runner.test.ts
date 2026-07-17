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
  expect(emit).toHaveBeenNthCalledWith(2, expect.objectContaining({
    agentId: 'a1',
    status: 'idle',
    message: 'implemented'
  }));
});

it('reports an actionable error when Codex exits unsuccessfully', async () => {
  const execute = vi.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'tests failed' });
  const emit = vi.fn();
  const runner = new CodexRunner('a1', 'C:/tmp/agent-a1', execute, emit);

  await runner.runNext();

  expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({
    agentId: 'a1',
    status: 'error',
    message: 'tests failed'
  }));
});

it('supports assigning a task before running the next checkpoint', async () => {
  const execute = vi.fn().mockResolvedValue({ code: 0, stdout: 'implemented', stderr: '' });
  const runner = new CodexRunner('a1', 'C:/tmp/agent-a1', execute, vi.fn());

  await expect(runner.accept({ id: 'task-1', type: 'assign_task', payload: { taskTitle: 'Fix tests' } })).resolves.toEqual({ ok: true });
  await runner.runNext();

  expect(execute).toHaveBeenCalledWith(expect.objectContaining({
    args: ['exec', expect.stringContaining('Fix tests')]
  }));
});

it('extracts changed files, test summary, and a log tail from Codex output', async () => {
  const execute = vi.fn().mockResolvedValue({
    code: 0,
    stdout: 'CHANGED_FILES: src/format.ts, test/format.test.ts\nTEST_RESULT: passed\nimplemented',
    stderr: ''
  });
  const emit = vi.fn();
  await new CodexRunner('a1', 'C:/tmp/agent-a1', execute, emit).runNext();

  expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({
    changedFiles: ['src/format.ts', 'test/format.test.ts'],
    summary: 'passed',
    logTail: expect.arrayContaining(['implemented'])
  }));
});
