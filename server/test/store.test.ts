import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db.js';
import { createStore } from '../store.js';
import type { Agent } from '../protocol.js';

const agent: Agent = {
  id: 'a1',
  name: 'Builder',
  role: 'builder',
  status: 'idle',
  zone: 'desk',
  x: 1,
  y: 2,
  lastUpdated: '2026-01-01T00:00:00.000Z'
};

describe('createStore persistence', () => {
  const databases: Array<ReturnType<typeof openDatabase>> = [];

  afterEach(() => {
    for (const database of databases.splice(0)) database.close();
  });

  it('persists snapshots, updates, commands, and acknowledgements', () => {
    const database = openDatabase(':memory:');
    databases.push(database);
    const store = createStore([agent], 'mock', database);
    const queued = store.enqueue({ id: 'c1', agentId: 'a1', type: 'pause' });

    expect(store.snapshot().commands).toEqual([queued]);
    const updated = { ...agent, status: 'working' as const };
    store.updateAgent(updated);
    expect(store.snapshot().agents[0]).toEqual(updated);

    expect(store.take('a1')?.status).toBe('acknowledged');
    expect(store.snapshot().commands[0]?.status).toBe('acknowledged');

    const reopened = createStore([], 'mock', database);
    expect(reopened.snapshot().agents).toEqual([updated]);
    expect(reopened.snapshot().commands[0]?.status).toBe('acknowledged');
  });

  it('does not expose mutable internal snapshot records', () => {
    const database = openDatabase(':memory:');
    databases.push(database);
    const store = createStore([agent], 'mock', database);
    store.enqueue({ id: 'c1', agentId: 'a1', type: 'pause' });
    const snapshot = store.snapshot();
    snapshot.agents[0]!.name = 'Changed';
    snapshot.commands[0]!.id = 'changed';

    expect(store.snapshot().agents[0]?.name).toBe('Builder');
    expect(store.snapshot().commands[0]?.id).toBe('c1');
  });
});
