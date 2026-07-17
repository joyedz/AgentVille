import { describe, expect, it } from 'vitest';
import { CommandQueue } from '../command-queue.js';
import { openDatabase } from '../db.js';

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

  it('preserves row insertion order when restoring commands', () => {
    const database = openDatabase(':memory:');
    database.prepare(
      'INSERT INTO commands (id, agent_id, type, payload, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('c1', 'a1', 'pause', null, 'pending', '2026-01-02T00:00:00.000Z');
    database.prepare(
      'INSERT INTO commands (id, agent_id, type, payload, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('c2', 'a1', 'resume', null, 'pending', '2026-01-01T00:00:00.000Z');

    const queue = new CommandQueue(database);
    expect(queue.take('a1')?.id).toBe('c1');
    expect(queue.take('a1')?.id).toBe('c2');
    database.close();
  });

  it('returns the canonical command when another queue inserted the id first', () => {
    const database = openDatabase(':memory:');
    const waitingQueue = new CommandQueue(database);
    const writerQueue = new CommandQueue(database);
    const inserted = writerQueue.enqueue({ id: 'c1', agentId: 'a1', type: 'pause' });

    const canonical = waitingQueue.enqueue({ id: 'c1', agentId: 'a2', type: 'resume' });
    expect(canonical).not.toBe(inserted);
    expect(canonical).toMatchObject({ id: 'c1', agentId: 'a1', type: 'pause' });
    expect(waitingQueue.take('a1')?.id).toBe('c1');
    database.close();
  });

  it('atomically claims a pending command across queue instances', () => {
    const database = openDatabase(':memory:');
    const writer = new CommandQueue(database);
    writer.enqueue({ id: 'c1', agentId: 'a1', type: 'pause' });
    const contender = new CommandQueue(database);

    expect(writer.take('a1')?.id).toBe('c1');
    expect(contender.take('a1')).toBeUndefined();
    database.close();
  });
});
