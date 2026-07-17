import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { buildApp } from '../app.js';

const require = createRequire(import.meta.url);
const WebSocket = (require('ws') as { WebSocket: new (url: string) => {
  on(event: string, listener: (...args: any[]) => void): void;
  close(): void;
} }).WebSocket;

describe('mock control plane app', () => {
  const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];
  afterEach(async () => {
    for (const app of apps.splice(0)) await app.close();
  });

  it('returns deterministic state snapshot', async () => {
    const app = buildApp({ database: ':memory:', mode: 'mock' });
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/api/state' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.mode).toBe('mock');
    expect(body.agents.map((agent: { id: string }) => agent.id)).toEqual(['builder', 'tester', 'documenter']);
  });

  it('validates and dispatches commands', async () => {
    const app = buildApp({ database: ':memory:', mode: 'mock' });
    apps.push(app);
    expect((await app.inject({ method: 'POST', url: '/api/agents/missing/commands', payload: { id: 'c1', type: 'pause' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/agents/builder/commands', payload: { type: 'pause' } })).statusCode).toBe(400);
    const response = await app.inject({ method: 'POST', url: '/api/agents/builder/commands', payload: { id: 'c1', type: 'pause' } });
    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({ id: 'c1', agentId: 'builder', type: 'pause' });
  });

  it('marks commands that the runner cannot accept as failed', async () => {
    const app = buildApp({ database: ':memory:', mode: 'mock' });
    apps.push(app);

    const stop = await app.inject({ method: 'POST', url: '/api/agents/builder/commands', payload: { id: 'stop-1', type: 'stop' } });
    expect(stop.json()).toMatchObject({ id: 'stop-1', status: 'done' });
    const pause = await app.inject({ method: 'POST', url: '/api/agents/builder/commands', payload: { id: 'pause-after-stop', type: 'pause' } });
    expect(pause.json()).toMatchObject({ id: 'pause-after-stop', status: 'failed', error: 'pause is not valid in the current state' });

    const duplicate = await app.inject({ method: 'POST', url: '/api/agents/builder/commands', payload: { id: 'pause-after-stop', type: 'pause' } });
    expect(duplicate.json()).toMatchObject({ id: 'pause-after-stop', status: 'failed', error: 'pause is not valid in the current state' });

    const state = (await app.inject({ method: 'GET', url: '/api/state' })).json();
    expect(state.agents.find((agent: { id: string }) => agent.id === 'builder')).toMatchObject({ status: 'stopped' });
    expect(state.commands.find((command: { id: string }) => command.id === 'pause-after-stop')).toMatchObject({ status: 'failed', error: 'pause is not valid in the current state' });
  });

  it('starts an idle runner immediately when assigning a task', async () => {
    const app = buildApp({ database: ':memory:', mode: 'mock' });
    apps.push(app);

    await app.advanceMockAgents(['tester']);
    await app.advanceMockAgents(['tester']);
    const approve = await app.inject({ method: 'POST', url: '/api/agents/tester/commands', payload: { id: 'approve-tester', type: 'approve' } });
    expect(approve.json()).toMatchObject({ status: 'done' });
    await app.advanceMockAgents(['tester']);
    await app.advanceMockAgents(['tester']);

    const before = (await app.inject({ method: 'GET', url: '/api/state' })).json();
    expect(before.agents.find((agent: { id: string }) => agent.id === 'tester')).toMatchObject({ status: 'idle', summary: 'task complete' });

    const assign = await app.inject({ method: 'POST', url: '/api/agents/tester/commands', payload: { id: 'assign-tester', type: 'assign_task', payload: { taskTitle: 'new task' } } });
    expect(assign.json()).toMatchObject({ id: 'assign-tester', status: 'done' });
    const after = (await app.inject({ method: 'GET', url: '/api/state' })).json();
    expect(after.agents.find((agent: { id: string }) => agent.id === 'tester')).toMatchObject({ status: 'working', checkpoint: 'new task' });
    expect(after.agents.find((agent: { id: string }) => agent.id === 'tester')).not.toHaveProperty('summary');
  });

  it('clears runner messages when a subsequent event omits them', async () => {
    const app = buildApp({ database: ':memory:', mode: 'mock' });
    apps.push(app);

    const before = (await app.inject({ method: 'GET', url: '/api/state' })).json();
    expect(before.agents.find((agent: { id: string }) => agent.id === 'builder')).toMatchObject({ status: 'blocked', message: 'approval required' });
    const approve = await app.inject({ method: 'POST', url: '/api/agents/builder/commands', payload: { id: 'approve-builder', type: 'approve' } });
    expect(approve.json()).toMatchObject({ status: 'done' });
    const after = (await app.inject({ method: 'GET', url: '/api/state' })).json();
    expect(after.agents.find((agent: { id: string }) => agent.id === 'builder')).not.toHaveProperty('message');
  });

  it('sends the initial state snapshot over WebSocket', async () => {
    const app = buildApp({ database: ':memory:', mode: 'mock' });
    apps.push(app);
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('server did not bind');
    const message = await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
      socket.on('message', (value: { toString(): string }) => { resolve(value.toString()); socket.close(); });
      socket.on('error', reject);
    });
    expect(JSON.parse(message)).toMatchObject({ type: 'state.snapshot', data: { mode: 'mock' } });
  });
});
