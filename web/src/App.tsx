import { useEffect, useRef, useState } from 'react';
import type { Game } from 'phaser';
import { agentSchema, commandSchema, type Agent as ProtocolAgent, type Command } from '../../server/protocol.js';
import { connect, sendCommand, type ServerMessage } from './api.js';
import { createOfficeGame, type OfficeAgent } from './game/OfficeScene.js';
import { Inspector, type InspectorAgent } from './components/Inspector.js';
import { AssignTaskDialog, type CommandBody } from './components/AssignTaskDialog.js';

type Agent = OfficeAgent & Pick<ProtocolAgent, 'lastUpdated' | 'message' | 'summary' | 'x' | 'y' | 'currentTaskId' | 'currentTaskTitle' | 'checkpoint' | 'changedFiles' | 'logTail'>;

type Snapshot = {
  mode?: 'mock' | 'codex';
  agents?: Agent[];
};

export type ClientState = {
  mode: 'mock' | 'codex';
  agents: Agent[];
  commands?: Command[];
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
  return { state, valid: true };
}

export function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [clientState, setClientState] = useState<ClientState>({ mode: 'mock', agents: [], commands: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deskAssignmentAgentId, setDeskAssignmentAgentId] = useState<string | null>(null);
  const [deskNotice, setDeskNotice] = useState<string | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'closed' | 'error'>('connecting');
  const { agents, mode } = clientState;
  const agentsRef = useRef<Agent[]>([]);
  agentsRef.current = agents;

  function handleEmptyDeskSelected(): void {
    const target = agentsRef.current.find((agent) => agent.status === 'idle' || agent.status === 'stopped');
    if (!target) {
      setDeskNotice('No idle crew available. Select an agent to assign a task.');
      return;
    }
    setDeskNotice(null);
    setDeskAssignmentAgentId(target.id);
  }

  useEffect(() => {
    if (!mapRef.current) return undefined;
    const game = createOfficeGame(mapRef.current, setSelectedId, handleEmptyDeskSelected);
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
  const selectedAgent = agents.find((agent) => agent.id === selectedId);

  async function handleCommand(agentId: string, command: CommandBody): Promise<unknown> {
    const body = { ...command, id: command.id ?? `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    return sendCommand(agentId, body);
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
      <section className="workspace">
        <div className="map-panel">
          <div ref={mapRef} className="office-map" aria-label="Agentville office map" />
          <p className="map-hint">Select an agent on the map to inspect their current state.</p>
          {deskNotice && <p className="desk-notice" role="status">{deskNotice}</p>}
        </div>
        <Inspector agent={selectedAgent as InspectorAgent | undefined} commands={clientState.commands} onCommand={handleCommand} />
      </section>
      {deskAssignmentAgentId && <AssignTaskDialog
        agentId={deskAssignmentAgentId}
        open
        onClose={() => setDeskAssignmentAgentId(null)}
        onCommand={handleCommand}
      />}
    </main>
  );
}
