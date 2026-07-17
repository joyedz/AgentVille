import { afterEach, describe, expect, it, vi } from 'vitest';
import { access, rm } from 'node:fs/promises';
import { buildApp } from '../app.js';
import { openDatabase } from '../db.js';
import { createStore } from '../store.js';
import { createSeedAgents } from '../seed.js';
import { recoverActiveAgent } from '../runner.js';
import { workspacePath } from '../workspaces.js';

describe('startup recovery', () => {
  const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

  afterEach(async () => {
    for (const app of apps.splice(0)) await app.close();
  });

  it('converts a working agent to a paused checkpoint', () => {
    const working = createSeedAgents()[0]!;
    expect(recoverActiveAgent(working)).toMatchObject({
      status: 'paused',
      checkpoint: 'inspect',
      zone: 'desk'
    });
  });

  it('hydrates persisted state and pauses work that was active at shutdown', async () => {
    const database = openDatabase(':memory:');
    const persisted = createStore(createSeedAgents(), 'mock', database);
    persisted.updateAgent({ ...persisted.snapshot().agents[0]!, status: 'working' });

    const app = buildApp({ database, mode: 'mock' });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/api/state' });
    expect(response.json().agents.find((agent: { id: string }) => agent.id === 'builder')).toMatchObject({
      status: 'paused',
      checkpoint: 'inspect'
    });
  });

  it('constructs Codex runners with reset workspaces and the injected executor', async () => {
    const execute = vi.fn().mockResolvedValue({ code: 0, stdout: 'ok', stderr: '' });
    const app = buildApp({ database: ':memory:', mode: 'codex', execute });
    apps.push(app);

    await app.close();
    apps.splice(apps.indexOf(app), 1);

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      command: 'codex',
      cwd: expect.stringContaining('.agentville')
    }));
  });

  it('recreates a missing persisted workspace without requiring a fresh agent', async () => {
    const database = openDatabase(':memory:');
    createStore(createSeedAgents(), 'codex', database);
    const target = workspacePath('builder');
    await rm(target, { recursive: true, force: true });

    const app = buildApp({ database, mode: 'codex', execute: vi.fn() });
    apps.push(app);
    await app.close();
    apps.splice(apps.indexOf(app), 1);

    await expect(access(`${target}/package.json`)).resolves.toBeUndefined();
    await rm(target, { recursive: true, force: true });
  });
});
