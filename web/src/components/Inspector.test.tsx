import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Inspector } from './Inspector.js';

const workingAgent = {
  id: 'a1', name: 'Tester', role: 'Engineer', status: 'working' as const,
  zone: 'desk' as const, checkpoint: 'implement', lastUpdated: '2026-07-17T00:00:00.000Z',
};

it('sends pause for a working agent', () => {
  const onCommand = vi.fn();
  render(<Inspector agent={workingAgent} onCommand={onCommand} />);
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(onCommand).toHaveBeenCalledWith('a1', { type: 'pause' });
});

it('shows and dispatches approve for a blocked agent', () => {
  const onCommand = vi.fn();
  render(<Inspector agent={{ ...workingAgent, status: 'blocked' }} onCommand={onCommand} />);
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(onCommand).toHaveBeenCalledWith('a1', { type: 'approve' });
});

it('validates and dispatches an assigned task', async () => {
  const onCommand = vi.fn(() => Promise.resolve({ status: 202 }));
  render(<Inspector agent={{ ...workingAgent, status: 'idle' }} onCommand={onCommand} />);
  fireEvent.click(screen.getByRole('button', { name: 'Assign task' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
  expect(screen.getByText('Task title is required.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'Ship inspector' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
  expect(onCommand).toHaveBeenCalledWith('a1', expect.objectContaining({
    id: expect.any(String), type: 'assign_task', payload: { taskTitle: 'Ship inspector' }
  }));
});

it('renders failed command feedback from command metadata', () => {
  render(<Inspector agent={workingAgent} onCommand={vi.fn()} commands={[{
    id: 'cmd-1', agentId: 'a1', type: 'pause', status: 'failed', error: 'Agent is already paused',
    createdAt: '2026-07-17T00:00:00.000Z'
  }]} />);
  expect(screen.getByText('Agent is already paused')).toBeTruthy();
});

it('guards against duplicate command submissions while pending', () => {
  let resolveCommand!: () => void;
  const onCommand = vi.fn(() => new Promise<void>((resolve) => { resolveCommand = resolve; }));
  render(<Inspector agent={workingAgent} onCommand={onCommand} />);
  const pauseButton = screen.getAllByRole('button', { name: 'Pause' }).at(-1)!;
  fireEvent.click(pauseButton);
  fireEvent.click(pauseButton);
  expect(onCommand).toHaveBeenCalledTimes(1);
  resolveCommand();
});
