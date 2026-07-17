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
});
