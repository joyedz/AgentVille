import { DatabaseSync } from 'node:sqlite';
import { CommandQueue, type CommandInput } from './command-queue.js';
import { openDatabase } from './db.js';
import type { Agent, Command } from './protocol.js';

export type StoreMode = 'mock' | 'codex';

export type StoreSnapshot = {
  mode: StoreMode;
  agents: Agent[];
  commands: Command[];
};

export type AgentStore = {
  snapshot(): StoreSnapshot;
  enqueue(input: CommandInput): Command;
  updateAgent(agent: Agent): void;
  take(agentId: string): Command | undefined;
  getCommand(id: string): Command | undefined;
  updateCommandStatus(id: string, status: Command['status']): Command | undefined;
  close(): void;
};

type AgentRow = { id: string; body: string };

function copyAgent(agent: Agent): Agent {
  return { ...agent };
}

export function createStore(
  initialAgents: Agent[],
  mode: StoreMode = 'mock',
  database: DatabaseSync = openDatabase(':memory:')
): AgentStore {
  const agents = new Map<string, Agent>();
  const insertAgent = database.prepare('INSERT OR IGNORE INTO agents (id, body) VALUES (?, ?)');
  for (const agent of initialAgents) {
    insertAgent.run(agent.id, JSON.stringify(agent));
  }

  const rows = database.prepare('SELECT id, body FROM agents ORDER BY rowid').all() as unknown as AgentRow[];
  for (const row of rows) {
    agents.set(row.id, JSON.parse(row.body) as Agent);
  }

  const updateAgentStatement = database.prepare(
    'INSERT INTO agents (id, body) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body'
  );
  const queue = new CommandQueue(database);
  let closed = false;
  const ensureOpen = (): void => {
    if (closed) throw new Error('AgentVille store is closed');
  };

  return {
    snapshot: () => {
      ensureOpen();
      return {
        mode,
        agents: [...agents.values()].map(copyAgent),
        commands: queue.list()
      };
    },
    enqueue: (input) => {
      ensureOpen();
      return queue.enqueue(input);
    },
    updateAgent: (agent) => {
      ensureOpen();
      const saved = copyAgent(agent);
      agents.set(saved.id, saved);
      updateAgentStatement.run(saved.id, JSON.stringify(saved));
    },
    take: (agentId) => {
      ensureOpen();
      return queue.take(agentId);
    },
    getCommand: (id) => {
      ensureOpen();
      return queue.get(id);
    },
    updateCommandStatus: (id, status) => {
      ensureOpen();
      return queue.updateStatus(id, status);
    },
    close: () => {
      if (closed) return;
      database.close();
      closed = true;
    }
  };
}
