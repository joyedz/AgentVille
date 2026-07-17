import type { Agent } from './protocol.js';

const seedTimestamp = '2026-01-01T00:00:00.000Z';

export const Builder: Agent = {
    id: 'builder', name: 'Builder', role: 'builder', status: 'working', zone: 'desk', x: 2, y: 2,
    currentTaskId: 'build-foundation', checkpoint: 'inspect', lastUpdated: seedTimestamp
};
export const Tester: Agent = {
    id: 'tester', name: 'Tester', role: 'tester', status: 'working', zone: 'desk', x: 5, y: 2,
    currentTaskId: 'test-foundation', checkpoint: 'inspect', lastUpdated: seedTimestamp
};
export const Documenter: Agent = {
    id: 'documenter', name: 'Documenter', role: 'documenter', status: 'working', zone: 'desk', x: 8, y: 2,
    currentTaskId: 'document-foundation', checkpoint: 'inspect', lastUpdated: seedTimestamp
};

export const seedAgents: Agent[] = [Builder, Tester, Documenter];

export function createSeedAgents(): Agent[] {
  return seedAgents.map((agent) => ({ ...agent }));
}
