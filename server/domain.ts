import type { AgentStatus, Zone } from './protocol.js';

const allowed: Record<AgentStatus, AgentStatus[]> = {
  working: ['paused', 'blocked', 'error', 'idle', 'stopped'],
  idle: ['working', 'stopped'],
  blocked: ['working', 'error', 'stopped'],
  error: ['idle', 'stopped'],
  paused: ['working', 'stopped'],
  stopped: ['idle']
};

export function assignZone(status: AgentStatus, slot: number): Zone {
  if (status === 'blocked' || status === 'error') return 'attention';
  if (status === 'working' || status === 'paused') return 'desk';
  return slot % 2 === 0 ? 'lounge' : 'coffee';
}

export function applyStatus<T extends { status: AgentStatus; zone: Zone }>(
  agent: T,
  next: AgentStatus
): T {
  if (!allowed[agent.status].includes(next)) {
    throw new Error(`Invalid transition: ${agent.status} -> ${next}`);
  }

  return {
    ...agent,
    status: next,
    zone: next === 'paused' ? agent.zone : assignZone(next, 0)
  };
}
