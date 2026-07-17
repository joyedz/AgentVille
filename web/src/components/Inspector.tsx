import { useMemo, useState } from 'react';
import type { AgentStatus, Command, Zone } from '../../../server/protocol.js';
import { AssignTaskDialog, type CommandBody } from './AssignTaskDialog.js';

export type InspectorAgent = {
  id: string;
  name: string;
  role?: string;
  status: AgentStatus;
  zone: Zone;
  checkpoint?: string;
  currentTaskId?: string;
  currentTaskTitle?: string;
  message?: string;
  summary?: string;
  changedFiles?: string[];
  logTail?: string[];
  lastUpdated?: string;
};

export type InspectorProps = {
  agent?: InspectorAgent | null;
  commands?: Command[];
  onCommand: (agentId: string, command: CommandBody) => Promise<unknown> | unknown;
};

const activeStatuses: AgentStatus[] = ['working', 'paused', 'blocked'];
const labels: Record<AgentStatus, string> = {
  working: 'WORKING', idle: 'IDLE', blocked: 'BLOCKED', error: 'ERROR', paused: 'PAUSED', stopped: 'STOPPED'
};

function actionFor(status: AgentStatus): { label: string; type: CommandBody['type'] } | null {
  if (status === 'working') return { label: 'Pause', type: 'pause' };
  if (status === 'paused') return { label: 'Resume', type: 'resume' };
  if (status === 'blocked') return { label: 'Approve', type: 'approve' };
  if (status === 'idle' || status === 'stopped' || status === 'error') return { label: 'Assign task', type: 'assign_task' };
  return null;
}

export function Inspector({ agent, commands = [], onCommand }: InspectorProps) {
  const [pendingType, setPendingType] = useState<CommandBody['type'] | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [instruction, setInstruction] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const agentId = agent?.id;
  const agentCommands = useMemo(
    () => agentId ? commands.filter((command) => command.agentId === agentId).slice(-5).reverse() : [],
    [commands, agentId]
  );

  if (!agent) {
    return <aside className="inspector"><p className="eyebrow">INSPECTOR</p><h2>Select an agent</h2><p className="inspector-empty">Select an agent on the map to inspect their mission state.</p></aside>;
  }

  const primaryAction = actionFor(agent.status);
  const canAssign = primaryAction?.type === 'assign_task';
  const currentTaskTitle = agent.currentTaskTitle ?? agentCommands.find((command) => command.id === agent.currentTaskId)?.payload?.taskTitle;

  async function dispatch(command: CommandBody): Promise<void> {
    if (pendingType) return;
    setPendingType(command.type);
    setFeedback(null);
    try {
      await onCommand(agentId!, command);
      setFeedback({ kind: 'success', text: 'Command accepted.' });
    } catch (cause) {
      setFeedback({ kind: 'error', text: cause instanceof Error ? cause.message : 'Command failed.' });
    } finally {
      setPendingType(null);
    }
  }

  async function submitInstruction(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = instruction.trim();
    if (!trimmed) return;
    await dispatch({ type: 'add_instruction', payload: { instruction: trimmed } });
    setInstruction('');
  }

  return (
    <aside className="inspector" aria-label={`Inspector for ${agent.name}`}>
      <div className="inspector-heading">
        <div>
          <p className="eyebrow">INSPECTOR / {agent.id}</p>
          <h2>{agent.name}</h2>
          <p className="agent-role">{agent.role ?? 'Agent'}</p>
        </div>
        <span className={`status-badge status-${agent.status}`}>{labels[agent.status]}</span>
      </div>

      <dl className="agent-meta">
        <div><dt>ZONE</dt><dd>{agent.zone}</dd></div>
        {agent.checkpoint && <div><dt>CHECKPOINT</dt><dd>{agent.checkpoint}</dd></div>}
        <div><dt>TASK ID</dt><dd>{agent.currentTaskId ?? '—'}</dd></div>
        {currentTaskTitle && <div><dt>TASK TITLE</dt><dd>{currentTaskTitle}</dd></div>}
      </dl>

      {(agent.summary || agent.message) && <section className="inspector-summary">
        {agent.summary && <><p className="section-label">SUMMARY</p><p>{agent.summary}</p></>}
        {agent.message && <><p className="section-label message-label">MESSAGE</p><p>{agent.message}</p></>}
      </section>}

      {agent.changedFiles && agent.changedFiles.length > 0 && <section className="inspector-section"><p className="section-label">CHANGED FILES</p><ul className="file-list">{agent.changedFiles.map((file) => <li key={file}>{file}</li>)}</ul></section>}

      <div className="inspector-actions">
        {canAssign ? (
          <button className="button-primary" type="button" onClick={() => setDialogOpen(true)} disabled={pendingType !== null}>Assign task</button>
        ) : primaryAction && <button className="button-primary" type="button" onClick={() => void dispatch({ type: primaryAction.type })} disabled={pendingType !== null}>{pendingType === primaryAction.type ? 'Sending…' : primaryAction.label}</button>}
        {activeStatuses.includes(agent.status) && <button className="button-danger" type="button" onClick={() => void dispatch({ type: 'stop' })} disabled={pendingType !== null}>{pendingType === 'stop' ? 'Stopping…' : 'Stop'}</button>}
      </div>

      {activeStatuses.includes(agent.status) && <form className="instruction-form" onSubmit={submitInstruction}>
        <label htmlFor="agent-instruction">Add instruction</label>
        <div className="inline-form"><input id="agent-instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Guide the next move…" disabled={pendingType !== null} /><button className="button-secondary" type="submit" disabled={pendingType !== null || !instruction.trim()}>Send</button></div>
      </form>}

      {feedback && <p className={`command-feedback feedback-${feedback.kind}`} role="status">{feedback.text}</p>}

      {agentCommands.length > 0 && <section className="command-list"><p className="section-label">RECENT COMMANDS</p>{agentCommands.map((command) => <div className="command-row" key={command.id}><span>{command.type.replace('_', ' ')}</span><span className={`command-status command-${command.status}`}>{command.status}</span>{command.error && <p className="command-error">{command.error}</p>}</div>)}</section>}

      {agent.logTail && agent.logTail.length > 0 && <section className="log-tail"><p className="section-label">LOG TAIL</p>{agent.logTail.slice(-3).map((line, index) => <code key={`${line}-${index}`}>{line}</code>)}</section>}

      <AssignTaskDialog agentId={agent.id} open={dialogOpen} onClose={() => setDialogOpen(false)} onCommand={onCommand} />
    </aside>
  );
}
