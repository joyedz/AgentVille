import type { CommandType } from './protocol.js';
import type { Agent } from './protocol.js';

export type RunnerEvent = {
  agentId: string;
  status: 'working' | 'blocked' | 'error' | 'idle' | 'paused' | 'stopped';
  currentTaskId?: string;
  checkpoint?: string;
  message?: string;
  summary?: string;
  changedFiles?: string[];
  logTail?: string[];
};

export type RunnerAcceptResult =
  | { ok: true; message?: string; summary?: string }
  | { ok: false; error: string; message?: string; summary?: string };

export interface Runner {
  runNext(): Promise<void>;
  accept(command: { id?: string; type: CommandType; payload?: unknown }): Promise<RunnerAcceptResult>;
}

/** Convert work that was active at process shutdown into an explicit recovery checkpoint. */
export function recoverActiveAgent(agent: Agent): Agent {
  return agent.status === 'working'
    ? { ...agent, status: 'paused', checkpoint: agent.checkpoint ?? 'inspect' }
    : { ...agent };
}
