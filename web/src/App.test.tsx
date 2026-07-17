import { describe, expect, it } from 'vitest';
import { reduceMessage, type ClientState } from './App.js';

const initial: ClientState = { mode: 'mock', agents: [] };
const validAgent = {
  id: 'builder', name: 'Builder', role: 'Engineer', status: 'working', zone: 'desk',
  x: 260, y: 280, lastUpdated: '2026-07-17T00:00:00.000Z'
};

describe('reduceMessage', () => {
  it('ignores malformed agent updates and reports an invalid payload', () => {
    const result = reduceMessage(initial, {
      type: 'agent.updated',
      data: { id: 'builder', name: 'Builder', status: 'not-a-status', zone: 'desk' }
    });

    expect(result.valid).toBe(false);
    expect(result.state).toEqual(initial);
  });

  it('rejects a snapshot atomically when any agent is malformed', () => {
    const result = reduceMessage(initial, {
      type: 'state.snapshot',
      data: { mode: 'mock', agents: [validAgent, { ...validAgent, id: 'bad', zone: 'invalid' }] }
    });

    expect(result.valid).toBe(false);
    expect(result.state).toEqual(initial);
  });
});
