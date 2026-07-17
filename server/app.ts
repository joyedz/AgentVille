import { DatabaseSync } from 'node:sqlite';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { assignZone } from './domain.js';
import { MockRunner } from './mock-runner.js';
import { commandRequestSchema, type Agent, type Command } from './protocol.js';
import type { RunnerEvent, Runner } from './runner.js';
import { createSeedAgents } from './seed.js';
import { createStore, type AgentStore, type StoreMode } from './store.js';
import { openDatabase } from './db.js';

export type BuildAppOptions = {
  database?: string | DatabaseSync;
  mode?: 'mock';
};

export type ControlPlaneApp = FastifyInstance & {
  advanceMockAgents(agentIds?: string[]): Promise<void>;
  startMockLoop(): Promise<void>;
};

type ClientSocket = {
  readyState: number;
  send(data: string): void;
  close?(): void;
  on(event: 'close', listener: () => void): void;
};

export function buildApp(options: BuildAppOptions = {}): ControlPlaneApp {
  const app = Fastify({ logger: false });
  const mode: StoreMode = options.mode ?? 'mock';
  const database = typeof options.database === 'string'
    ? openDatabase(options.database)
    : options.database ?? openDatabase('agentville.db');
  const store = createStore(createSeedAgents(), mode, database);
  const clients = new Set<ClientSocket>();
  const runners = new Map<string, Runner>();
  const dispatchChains = new Map<string, Promise<void>>();
  const checkpointPlan = ['inspect', 'approval', 'implement'];
  let closing = false;

  const broadcast = (message: unknown): void => {
    const encoded = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState !== 1) {
        clients.delete(client);
        continue;
      }
      try {
        client.send(encoded);
      } catch {
        clients.delete(client);
        try {
          client.close?.();
        } catch {
          // The socket may already be closed; dropping it is sufficient.
        }
      }
    }
  };

  const updateFromRunner = (event: RunnerEvent): void => {
    const current = store.snapshot().agents.find((agent) => agent.id === event.agentId);
    if (!current) return;
    const status = event.status === 'error' ? 'error' : event.status;
    const updated: Agent = {
      ...current,
      status,
      zone: assignZone(status, 0),
      currentTaskId: event.currentTaskId ?? current.currentTaskId,
      checkpoint: event.checkpoint ?? current.checkpoint,
      message: event.message,
      summary: event.summary,
      lastUpdated: new Date().toISOString()
    };
    store.updateAgent(updated);
    broadcast({ type: 'agent.updated', data: updated });
  };

  for (const agent of createSeedAgents()) {
    runners.set(agent.id, new MockRunner(agent.id, updateFromRunner, checkpointPlan));
  }

  let loopStarted = false;
  const advanceMockAgents = async (agentIds = [...runners.keys()]): Promise<void> => {
    for (const agentId of agentIds) await runners.get(agentId)?.runNext();
  };
  const startMockLoop = async (): Promise<void> => {
    if (loopStarted) return;
    loopStarted = true;
    await advanceMockAgents();
    // Keep the seeded Builder at its deterministic approval gate so the
    // control plane has a blocked checkpoint to demonstrate immediately.
    await runners.get('builder')?.runNext();
  };
  app.decorate('advanceMockAgents', advanceMockAgents);
  app.decorate('startMockLoop', startMockLoop);
  const startupPromise = startMockLoop().catch((error: unknown) => {
    if (!closing) {
      broadcast({
        type: 'runner.error',
        data: { message: error instanceof Error ? error.message : String(error) }
      });
    }
  });

  const dispatchAgent = async (agentId: string): Promise<void> => {
    const runner = runners.get(agentId);
    if (!runner) return;
    while (true) {
      const next = store.take(agentId);
      if (!next) return;
      broadcast({ type: 'command.updated', data: next });
      try {
        const result = await runner.accept(next);
        if (!result.ok) {
          const failed = store.markCommandFailed(next.id, result.error);
          if (failed) {
            broadcast({ type: 'command.updated', data: failed });
          }
          continue;
        }
        if (next.type === 'assign_task') await runner.runNext();
        const done = store.updateCommandStatus(next.id, 'done');
        if (done) broadcast({ type: 'command.updated', data: done });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failed = store.markCommandFailed(next.id, message);
        if (failed) {
          broadcast({ type: 'command.updated', data: failed });
        }
      }
    }
  };

  const enqueueDispatch = (agentId: string): Promise<void> => {
    const previous = dispatchChains.get(agentId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(() => dispatchAgent(agentId));
    dispatchChains.set(agentId, current);
    void current.finally(() => {
      if (dispatchChains.get(agentId) === current) dispatchChains.delete(agentId);
    }).catch(() => undefined);
    return current;
  };

  app.register(cors, { origin: true });
  app.register(websocket);

  app.get('/api/state', async () => store.snapshot());

  app.post('/api/agents/:id/commands', async (request, reply) => {
    const agentId = (request.params as { id?: string }).id;
    const known = store.snapshot().agents.some((agent) => agent.id === agentId);
    if (!known) return reply.code(404).send({ error: 'Unknown agent' });
    const parsed = commandRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid command', issues: parsed.error.issues });

    const command = store.enqueue({ agentId: agentId!, ...parsed.data });
    broadcast({ type: 'command.updated', data: command });
    if (command.status === 'pending') await enqueueDispatch(agentId!);
    return reply.code(202).send(store.getCommand(command.id) ?? command);
  });

  // Register the websocket route after the plugin has been loaded. Fastify
  // defers plugin execution, so declaring this route immediately would make
  // it a regular HTTP handler rather than a websocket handler.
  app.after(() => {
    app.get('/ws', { websocket: true }, (socket) => {
      const client = socket as unknown as ClientSocket;
      clients.add(client);
      try {
        client.send(JSON.stringify({ type: 'state.snapshot', data: store.snapshot() }));
      } catch {
        clients.delete(client);
        try {
          client.close?.();
        } catch {
          // The socket may already be closed; dropping it is sufficient.
        }
      }
      client.on('close', () => clients.delete(client));
    });
  });

  app.addHook('onClose', async () => {
    closing = true;
    await startupPromise;
    await Promise.allSettled([...dispatchChains.values()]);
    dispatchChains.clear();
    clients.clear();
    store.close();
  });

  return app as unknown as ControlPlaneApp;
}

export type { AgentStore, Command };
