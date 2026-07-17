import { useEffect, useRef, useState } from 'react';
import type { Game } from 'phaser';
import { connect, type ServerMessage } from './api.js';
import { createOfficeGame, type OfficeAgent } from './game/OfficeScene.js';

type Agent = OfficeAgent & {
  lastUpdated?: string;
  message?: string;
  summary?: string;
};

type Snapshot = {
  mode?: 'mock' | 'codex';
  agents?: Agent[];
};

function isAgent(value: unknown): value is Agent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Agent>;
  return typeof candidate.id === 'string' && typeof candidate.name === 'string' &&
    typeof candidate.zone === 'string' && typeof candidate.status === 'string';
}

export function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [mode, setMode] = useState<'mock' | 'codex'>('mock');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'closed' | 'error'>('connecting');

  useEffect(() => {
    if (!mapRef.current) return undefined;
    const game = createOfficeGame(mapRef.current, setSelectedId);
    gameRef.current = game;
    const connectionHandle = connect(handleMessage, (status) => {
      setConnection(status === 'open' ? 'live' : status);
    });

    function handleMessage(message: ServerMessage): void {
      if (message.type === 'state.snapshot') {
        const snapshot = (message.data ?? {}) as Snapshot;
        setMode(snapshot.mode ?? 'mock');
        setAgents(snapshot.agents?.filter(isAgent) ?? []);
      } else if (message.type === 'agent.updated' && isAgent(message.data)) {
        const agent = message.data;
        setAgents((current) => {
          const index = current.findIndex((currentAgent) => currentAgent.id === agent.id);
          if (index < 0) return [...current, agent];
          const next = [...current];
          next[index] = agent;
          return next;
        });
      }
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
