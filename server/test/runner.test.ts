import { expect, it, vi } from 'vitest';
import { MockRunner } from '../mock-runner.js';

it('emits working, blocked, then working after approval', async () => {
  const emit = vi.fn();
  const runner = new MockRunner('builder', emit, ['inspect', 'approval', 'implement']);

  await runner.runNext();
  await runner.runNext();

  expect(emit).toHaveBeenCalledWith(expect.objectContaining({ status: 'blocked' }));
  await runner.accept({ type: 'approve' });
  expect(emit).toHaveBeenCalledWith(expect.objectContaining({ status: 'working', checkpoint: 'implement' }));
});

it('pauses, resumes, and stops without advancing work', async () => {
  const emit = vi.fn();
  const runner = new MockRunner('builder', emit, ['inspect', 'implement']);
  await runner.runNext();
  await runner.accept({ type: 'pause' });
  expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'paused', checkpoint: 'inspect' }));
  await runner.runNext();
  await runner.accept({ type: 'resume' });
  expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'working', checkpoint: 'inspect' }));
  await runner.accept({ type: 'stop' });
  expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'stopped', message: 'stopped' }));
  await runner.runNext();
  expect(emit).toHaveBeenCalledTimes(4);
});

it('returns a failure result for invalid commands', async () => {
  const emit = vi.fn();
  const runner = new MockRunner('builder', emit, ['inspect']);

  const result = await runner.accept({ type: 'unsupported' as never });
  expect(result).toMatchObject({ ok: false });
  expect(emit).not.toHaveBeenCalled();
});

it('retains instructions while rejecting assignment from a working runner', async () => {
  const emit = vi.fn();
  const runner = new MockRunner('builder', emit, ['inspect', 'approval', 'implement']);
  await runner.accept({ type: 'add_instruction', payload: { instruction: 'Use the fast path' } });
  await runner.runNext();
  expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'working', message: 'Use the fast path' }));
  const result = await runner.accept({ type: 'assign_task', payload: { taskTitle: 'custom-task' } });
  expect(result).toMatchObject({ ok: false, error: 'assign_task is only valid while idle, stopped, or completed' });
});

it('rejects assignment while blocked or paused', async () => {
  const blockedEmit = vi.fn();
  const blockedRunner = new MockRunner('builder', blockedEmit, ['inspect', 'approval', 'implement']);
  await blockedRunner.runNext();
  await blockedRunner.runNext();
  const blockedResult = await blockedRunner.accept({ type: 'assign_task', payload: { taskTitle: 'blocked-task' } });
  expect(blockedResult).toMatchObject({ ok: false, error: 'assign_task is only valid while idle, stopped, or completed' });

  const pausedEmit = vi.fn();
  const pausedRunner = new MockRunner('builder', pausedEmit, ['inspect', 'implement']);
  await pausedRunner.runNext();
  await pausedRunner.accept({ type: 'pause' });
  const pausedResult = await pausedRunner.accept({ type: 'assign_task', payload: { taskTitle: 'paused-task' } });
  expect(pausedResult).toMatchObject({ ok: false, error: 'assign_task is only valid while idle, stopped, or completed' });
});

it('restarts an idle runner with a fresh checkpoint plan when assigning a task', async () => {
  const emit = vi.fn();
  const runner = new MockRunner('builder', emit, ['inspect', 'implement']);

  await runner.runNext();
  await runner.runNext();
  await runner.runNext();
  expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'idle' }));

  const result = await runner.accept({ type: 'assign_task', payload: { taskTitle: 'new-task' } });
  expect(result).toMatchObject({ ok: true });
  await runner.runNext();
  expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'working', checkpoint: 'new-task' }));
  await runner.runNext();
  expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'working', checkpoint: 'inspect' }));
});

it('restarts a stopped runner with a fresh checkpoint plan when assigning a task', async () => {
  const emit = vi.fn();
  const runner = new MockRunner('builder', emit, ['inspect', 'implement']);

  await runner.runNext();
  await runner.accept({ type: 'stop' });
  const result = await runner.accept({ type: 'assign_task', payload: { taskTitle: 'stopped-task' } });
  expect(result).toMatchObject({ ok: true });

  await runner.runNext();
  expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'working', checkpoint: 'stopped-task' }));
  await runner.runNext();
  expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'working', checkpoint: 'inspect' }));
});
