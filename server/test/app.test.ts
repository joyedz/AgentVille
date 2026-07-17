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
