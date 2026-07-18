import { useEffect, useRef, useState } from 'react';
import type { Game } from 'phaser';
import { agentSchema, commandSchema, type Agent as ProtocolAgent, type Command } from '../../server/protocol.js';
import { connect, fetchState, sendCommand, type ServerMessage } from './api.js';
import { createOfficeGame, type OfficeAgent } from './game/OfficeScene.js';
import { Inspector, type InspectorAgent } from './components/Inspector.js';
import type { CommandBody } from './components/AssignTaskDialog.js';

type Agent = OfficeAgent & Pick<ProtocolAgent, 'lastUpdated' | 'message' | 'summary' | 'x' | 'y' | 'currentTaskId' | 'currentTaskTitle' | 'checkpoint' | 'changedFiles' | 'logTail'>;

type Snapshot = {
  mode?: 'mock' | 'codex';
  agents?: Agent[];
};

export type ClientState = {
  mode: 'mock' | 'codex';
  agents: Agent[];
  commands?: Command[];
  notice?: string;
};

export function reduceMessage(state: ClientState, message: ServerMessage): { state: ClientState; valid: boolean } {
  if (message.type === 'state.snapshot') {
    const snapshot = message.data;
    if (!snapshot || typeof snapshot !== 'object') return { state, valid: false };
    const input = snapshot as Snapshot;
    if (!Array.isArray(input.agents)) return { state, valid: false };
    const agents: Agent[] = [];
    const commands: Command[] = [];
    let valid = input.mode === undefined || input.mode === 'mock' || input.mode === 'codex';
    for (const candidate of input.agents) {
      const parsed = agentSchema.safeParse(candidate);
      if (parsed.success) agents.push(parsed.data);
      else valid = false;
    }
    if (Array.isArray((input as Snapshot & { commands?: unknown }).commands)) {
      for (const candidate of (input as Snapshot & { commands: unknown[] }).commands) {
        const parsed = commandSchema.safeParse(candidate);
        if (parsed.success) commands.push(parsed.data);
        else valid = false;
      }
    }
    if (!valid) return { state, valid: false };
    const mode = input.mode === 'mock' || input.mode === 'codex' ? input.mode : state.mode;
    return { state: { mode, agents, commands }, valid: true };
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
  if (message.type === 'command.updated') {
    const parsed = commandSchema.safeParse(message.data);
    if (!parsed.success) return { state, valid: false };
    const currentCommands = state.commands ?? [];
    const index = currentCommands.findIndex((command) => command.id === parsed.data.id);
    const commands = [...currentCommands];
    if (index < 0) commands.push(parsed.data);
    else commands[index] = parsed.data;
    return { state: { ...state, commands }, valid: true };
  }
  if (message.type === 'runner.error') {
    const data = message.data;
    if (!data || typeof data !== 'object' || typeof (data as { message?: unknown }).message !== 'string') {
      return { state, valid: false };
    }
    return { state: { ...state, notice: (data as { message: string }).message }, valid: true };
  }
  return { state, valid: true };
}

const httpPollingIntervalMs = 1_000;

export function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [clientState, setClientState] = useState<ClientState>({ mode: 'mock', agents: [], commands: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'closed' | 'error'>('connecting');
  const { agents, mode } = clientState;
  const refreshStateRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    if (!mapRef.current) return undefined;
    const game = createOfficeGame(mapRef.current, setSelectedId);
    gameRef.current = game;

    function handleMessage(message: ServerMessage): void {
      setClientState((current) => {
        const result = reduceMessage(current, message);
        if (!result.valid) setConnection('error');
        return result.state;
      });
    }

    async function refreshState(): Promise<void> {
      try {
        handleMessage({ type: 'state.snapshot', data: await fetchState() });
      } catch {
        setConnection((current) => current === 'live' ? current : 'error');
      }
    }

    refreshStateRef.current = refreshState;
    const connectionHandle = connect(handleMessage, (status) => {
      setConnection(status === 'open' ? 'live' : status);
      if (status === 'open') void refreshState();
    });
    void refreshState();

    return () => {
      refreshStateRef.current = async () => undefined;
      connectionHandle.close();
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (connection === 'live') return undefined;
    const pollingTimer = window.setInterval(() => {
      void refreshStateRef.current();
    }, httpPollingIntervalMs);
    return () => window.clearInterval(pollingTimer);
  }, [connection]);

  useEffect(() => {
    const scene = gameRef.current?.scene.getScene('OfficeScene') as { updateAgents?: (next: Agent[]) => void } | undefined;
    scene?.updateAgents?.(agents);
  }, [agents]);

  useEffect(() => {
    const scene = gameRef.current?.scene.getScene('OfficeScene') as { setSelectedAgent?: (agentId: string | null) => void } | undefined;
    scene?.setSelectedAgent?.(selectedId);
  }, [selectedId]);

  const connectionLabel = connection === 'live' ? 'LIVE' : connection.toUpperCase();
  const selectedAgent = agents.find((agent) => agent.id === selectedId);

  async function handleCommand(agentId: string, command: CommandBody): Promise<unknown> {
    const body = { ...command, id: command.id ?? `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    const result = await sendCommand(agentId, body);
    await refreshStateRef.current();
    return result;
  }

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
      {clientState.notice && <p className="runner-notice" role="status">{clientState.notice}</p>}
      <section className="workspace">
        <div className="map-panel">
          <div ref={mapRef} className="office-map" aria-hidden="true" />
          <p id="office-map-summary" className="visually-hidden">
            Agentville office map with Product desks, Coffee reset room, Lounge, and Attention room. Select an agent on the map or use the inspector.
          </p>
          <p className="map-hint">Select an agent on the map or from the roster below to inspect their current state.</p>
          <nav className="agent-roster" aria-label="Agent roster">
            {agents.length === 0
              ? <p className="roster-empty">Waiting for agents…</p>
              : agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className={`roster-item${agent.id === selectedId ? ' roster-item-active' : ''}`}
                  aria-pressed={agent.id === selectedId}
                  onClick={() => setSelectedId(agent.id)}
                >
                  <span className="roster-name">{agent.name}</span>
                  <span className={`status-badge status-${agent.status}`}>{agent.status.toUpperCase()}</span>
                </button>
              ))}
          </nav>
        </div>
        <Inspector agent={selectedAgent as InspectorAgent | undefined} commands={clientState.commands} onCommand={handleCommand} />
      </section>
    </main>
  );
}
