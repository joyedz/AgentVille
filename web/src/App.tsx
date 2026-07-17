import { useEffect, useRef, useState } from 'react';
import type { Game } from 'phaser';
import { agentSchema, type Agent as ProtocolAgent } from '../../server/protocol.js';
import { connect, type ServerMessage } from './api.js';
import { createOfficeGame, type OfficeAgent } from './game/OfficeScene.js';

type Agent = OfficeAgent & Pick<ProtocolAgent, 'lastUpdated' | 'message' | 'summary' | 'x' | 'y'>;

type Snapshot = {
  mode?: 'mock' | 'codex';
  agents?: Agent[];
};

export type ClientState = {
  mode: 'mock' | 'codex';
  agents: Agent[];
};

export function reduceMessage(state: ClientState, message: ServerMessage): { state: ClientState; valid: boolean } {
  if (message.type === 'state.snapshot') {
    const snapshot = message.data;
    if (!snapshot || typeof snapshot !== 'object') return { state, valid: false };
    const input = snapshot as Snapshot;
    if (!Array.isArray(input.agents)) return { state, valid: false };
    const agents: Agent[] = [];
    let valid = input.mode === undefined || input.mode === 'mock' || input.mode === 'codex';
    for (const candidate of input.agents) {
      const parsed = agentSchema.safeParse(candidate);
      if (parsed.success) agents.push(parsed.data);
      else valid = false;
    }
    const mode = input.mode === 'mock' || input.mode === 'codex' ? input.mode : state.mode;
    return { state: { mode, agents }, valid };
  }
  if (message.type === 'agent.updated') {
    const parsed = agentSchema.safeParse(message.data);
    if (!parsed.success) return { state, valid: false };
    const index = state.agents.findIndex((agent) => agent.id === parsed.data.id);
    const agents = [...state.agents];
    if (index < 0) agents.push(parsed.data);
    else agents[index] = parsed.data;
    return { state: { ...state, agents }, valid: true };
  }
  return { state, valid: true };
}

export function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [clientState, setClientState] = useState<ClientState>({ mode: 'mock', agents: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'closed' | 'error'>('connecting');
  const { agents, mode } = clientState;

  useEffect(() => {
    if (!mapRef.current) return undefined;
    const game = createOfficeGame(mapRef.current, setSelectedId);
    gameRef.current = game;
    const connectionHandle = connect(handleMessage, (status) => {
      setConnection(status === 'open' ? 'live' : status);
    });

    function handleMessage(message: ServerMessage): void {
      setClientState((current) => {
        const result = reduceMessage(current, message);
        if (!result.valid) setConnection('error');
        return result.state;
      });
    }

    return () => {
      connectionHandle.close();
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = gameRef.current?.scene.getScene('OfficeScene') as { updateAgents?: (next: Agent[]) => void } | undefined;
    scene?.updateAgents?.(agents);
  }, [agents]);

  const connectionLabel = connection === 'live' ? 'LIVE' : connection.toUpperCase();

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">CONTROL PLANE</p>
          <h1>Agentville Office</h1>
        </div>
        <div className="status-pills">
          <span className={`pill ${mode === 'mock' ? 'pill-mock' : 'pill-live'}`}>
            {mode === 'mock' ? 'MOCK MODE' : 'LIVE CODEX'}
          </span>
          <span className={`pill pill-connection pill-${connection}`}>{connectionLabel}</span>
        </div>
      </header>
      <section className="workspace">
        <div className="map-panel">
          <div ref={mapRef} className="office-map" aria-label="Agentville office map" />
          <p className="map-hint">Select an agent on the map to inspect their current state.</p>
        </div>
        <aside className="inspector-placeholder">
          <p className="eyebrow">INSPECTOR</p>
          <h2>Select an agent</h2>
          <p>Inspector controls arrive in the next task.</p>
        </aside>
      </section>
    </main>
  );
}
