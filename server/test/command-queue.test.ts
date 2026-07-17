import { describe, expect, it } from 'vitest';
import { CommandQueue } from '../command-queue.js';

describe('CommandQueue', () => {
  it('returns the original record for duplicate command ids', () => {
    const queue = new CommandQueue();
    const first = queue.enqueue({ id: 'c1', agentId: 'a1', type: 'pause' });

    expect(queue.enqueue({ id: 'c1', agentId: 'a1', type: 'pause' })).toBe(first);
  });

  it('dequeues commands in FIFO order per agent', () => {
    const queue = new CommandQueue();
    queue.enqueue({ id: 'c1', agentId: 'a1', type: 'pause' });
    queue.enqueue({ id: 'c2', agentId: 'a1', type: 'resume' });

    expect(queue.take('a1')?.id).toBe('c1');
    expect(queue.take('a1')?.id).toBe('c2');
    expect(queue.take('a1')).toBeUndefined();
  });

  it('keeps FIFO ordering isolated between agents and acknowledges taken commands', () => {
    const queue = new CommandQueue();
    const first = queue.enqueue({ id: 'a1-c1', agentId: 'a1', type: 'pause' });
    queue.enqueue({ id: 'a2-c1', agentId: 'a2', type: 'pause' });
    queue.enqueue({ id: 'a1-c2', agentId: 'a1', type: 'resume' });

    expect(queue.take('a2')?.id).toBe('a2-c1');
    expect(queue.take('a1')?.id).toBe('a1-c1');
    expect(queue.take('a1')?.id).toBe('a1-c2');
    expect(queue.enqueue({ id: 'a1-c1', agentId: 'a1', type: 'pause' })).toBe(first);
    expect(first.status).toBe('acknowledged');
  });
});
