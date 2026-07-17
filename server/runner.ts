import type { CommandType } from './protocol.js';

export type RunnerEvent = {
  agentId: string;
  status: 'working' | 'blocked' | 'error' | 'idle' | 'paused';
  checkpoint?: string;
  message?: string;
  summary?: string;
};

export interface Runner {
  runNext(): Promise<void>;
  accept(command: { type: CommandType; payload?: unknown }): Promise<void>;
}
