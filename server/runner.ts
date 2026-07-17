import type { CommandType } from './protocol.js';

export type RunnerEvent = {
  agentId: string;
  status: 'working' | 'blocked' | 'error' | 'idle' | 'paused' | 'stopped';
  currentTaskId?: string;
  checkpoint?: string;
  message?: string;
  summary?: string;
};

export type RunnerAcceptResult =
  | { ok: true; message?: string; summary?: string }
  | { ok: false; error: string; message?: string; summary?: string };

export interface Runner {
  runNext(): Promise<void>;
  accept(command: { id?: string; type: CommandType; payload?: unknown }): Promise<RunnerAcceptResult>;
}
