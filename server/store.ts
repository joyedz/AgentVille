import type { Agent, Command } from './protocol.js';
import { CommandQueue, type CommandInput } from './command-queue.js';

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
  /** Remove the next pending command for an agent. */
  take(agentId: string): Command | undefined;
};

export function createStore(initialAgents: Agent[], mode: StoreMode = 'mock'): AgentStore {
  const agents = new Map<string, Agent>(initialAgents.map((agent) => [agent.id, agent]));
  const queue = new CommandQueue();

  return {
    snapshot: () => ({
      mode,
      agents: [...agents.values()],
      // Commands are consumed by runners; pending commands are intentionally
      // not persisted in the state snapshot yet.
      commands: []
    }),
    enqueue: (input) => queue.enqueue(input),
    updateAgent: (agent) => {
      agents.set(agent.id, agent);
    },
    take: (agentId) => queue.take(agentId)
  };
}
