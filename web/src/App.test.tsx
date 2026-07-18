import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  selectAgent: undefined as ((id: string) => void) | undefined,
  emitMessage: undefined as ((message: unknown) => void) | undefined,
  sendCommand: vi.fn(),
  fetchState: vi.fn().mockResolvedValue({ mode: 'mock', agents: [], commands: [] })
}));

vi.mock('./game/OfficeScene.js', () => ({
  createOfficeGame: vi.fn((_parent: HTMLElement, selectAgent: (id: string) => void) => {
    harness.selectAgent = selectAgent;
    return {
    destroy: vi.fn(),
    scene: { getScene: vi.fn() }
    };
  })
}));

vi.mock('./api.js', () => ({
  connect: vi.fn((onMessage: (message: unknown) => void) => {
    harness.emitMessage = onMessage;
    return { close: vi.fn() };
  }),
  fetchState: harness.fetchState,
  sendCommand: harness.sendCommand
}));

import { App, reduceMessage, type ClientState } from './App.js';

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

  it('surfaces runner startup errors as a user-visible notice', () => {
    const result = reduceMessage(initial, { type: 'runner.error', data: { message: 'Codex could not start' } });

    expect(result.valid).toBe(true);
    expect(result.state.notice).toBe('Codex could not start');
  });
});

it('renders the selected inspector and dispatches a command', async () => {
  harness.sendCommand.mockResolvedValue({ status: 'accepted' });
  render(<App />);
  expect(screen.getByText('Agentville office map with Product desks, Coffee reset room, Lounge, and Attention room. Select an agent on the map or use the inspector.')).toBeTruthy();
  await waitFor(() => expect(harness.emitMessage).toBeDefined());
  act(() => harness.emitMessage?.({ type: 'state.snapshot', data: { mode: 'mock', agents: [{
    id: 'a1', name: 'Tester', role: 'Engineer', status: 'working', zone: 'desk', x: 1, y: 1,
    checkpoint: 'implement', currentTaskId: 'task-a1', changedFiles: ['web/src/App.tsx'], logTail: ['ready'],
    summary: 'A focused summary.', message: 'A live message.', lastUpdated: '2026-07-17T00:00:00.000Z'
  }, {
    id: 'a2', name: 'Idle', role: 'Tester', status: 'idle', zone: 'lounge', x: 2, y: 2,
    checkpoint: 'ready', changedFiles: [], logTail: [], lastUpdated: '2026-07-17T00:00:00.000Z'
  }], commands: [] } }));
  expect(reduceMessage({ mode: 'mock', agents: [], commands: [] }, { type: 'state.snapshot', data: { mode: 'mock', agents: [{
    id: 'a1', name: 'Tester', role: 'Engineer', status: 'working', zone: 'desk', x: 1, y: 1,
    checkpoint: 'implement', currentTaskId: 'task-a1', changedFiles: ['web/src/App.tsx'], logTail: ['ready'],
    summary: 'A focused summary.', message: 'A live message.', lastUpdated: '2026-07-17T00:00:00.000Z'
  }], commands: [] } }).valid).toBe(true);
  act(() => harness.selectAgent?.('a1'));
  expect(await screen.findByRole('heading', { name: 'Tester' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(harness.sendCommand).toHaveBeenCalledWith('a1', expect.objectContaining({ id: expect.any(String), type: 'pause' }));
  expect(screen.getByText('A focused summary.')).toBeTruthy();
  expect(screen.getByText('A live message.')).toBeTruthy();
  expect(screen.getByText('web/src/App.tsx')).toBeTruthy();
  await waitFor(() => expect(harness.fetchState).toHaveBeenCalledTimes(2));
});

it('selects an agent from the DOM roster without a Phaser click', async () => {
  harness.sendCommand.mockResolvedValue({ status: 'accepted' });
  render(<App />);
  await waitFor(() => expect(harness.emitMessage).toBeDefined());
  act(() => harness.emitMessage?.({ type: 'state.snapshot', data: { mode: 'mock', agents: [{
    id: 'a2', name: 'Idle', role: 'Tester', status: 'idle', zone: 'lounge', x: 2, y: 2,
    checkpoint: 'ready', changedFiles: [], logTail: [], lastUpdated: '2026-07-17T00:00:00.000Z'
  }], commands: [] } }));

  const rosterButton = await screen.findByRole('button', { name: /Idle\s+IDLE/i });
  fireEvent.click(rosterButton);

  expect(await screen.findByRole('heading', { name: 'Idle' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Assign task' })).toBeTruthy();
});
