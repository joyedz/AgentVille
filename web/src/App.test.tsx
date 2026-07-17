import { describe, expect, it } from 'vitest';
import { reduceMessage, type ClientState } from './App.js';

const initial: ClientState = { mode: 'mock', agents: [] };

describe('reduceMessage', () => {
  it('ignores malformed agent updates and reports an invalid payload', () => {
    const result = reduceMessage(initial, {
      type: 'agent.updated',
      data: { id: 'builder', name: 'Builder', status: 'not-a-status', zone: 'desk' }
    });

    expect(result.valid).toBe(false);
    expect(result.state).toEqual(initial);
  });
});
