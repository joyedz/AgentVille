import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../db.js';
import { createStore } from '../store.js';
import type { Agent } from '../protocol.js';

const agent: Agent = {
  id: 'a1', name: 'Builder', role: 'builder', status: 'idle', zone: 'desk', x: 1, y: 2,
  lastUpdated: '2026-01-01T00:00:00.000Z'
};

describe('store lifecycle', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  it('supports idempotent close and rejects use after close', () => {
    const store = createStore([agent]);
    store.close();
    expect(() => store.close()).not.toThrow();
    expect(() => store.snapshot()).toThrow(/closed/i);
  });

  it('persists through a real file close and reopen', () => {
    const directory = mkdtempSync(join(tmpdir(), 'agentville-'));
    directories.push(directory);
    const filename = join(directory, 'state.db');
    const first = createStore([agent], 'mock', openDatabase(filename));
    first.enqueue({ id: 'c1', agentId: 'a1', type: 'pause' });
    first.close();

    const reopened = createStore([], 'mock', openDatabase(filename));
    expect(reopened.snapshot().agents).toEqual([agent]);
    expect(reopened.snapshot().commands[0]?.id).toBe('c1');
    reopened.close();
  });
});
