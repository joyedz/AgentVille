import { useState } from 'react';

export type CommandBody = {
  id?: string;
  type: 'approve' | 'pause' | 'resume' | 'stop' | 'assign_task' | 'add_instruction';
  payload?: { taskTitle?: string; instruction?: string };
};

export type AssignTaskDialogProps = {
  agentId: string;
  open: boolean;
  onClose: () => void;
  onCommand: (agentId: string, command: CommandBody) => Promise<unknown> | unknown;
};

function commandId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random ?? `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AssignTaskDialog({ agentId, open, onClose, onCommand }: AssignTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Task title is required.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      await onCommand(agentId, {
        id: commandId(),
        type: 'assign_task',
        payload: { taskTitle: trimmed }
      });
      setTitle('');
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Command failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) onClose();
    }}>
      <section className="assign-dialog" role="dialog" aria-modal="true" aria-labelledby="assign-title">
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">NEXT MISSION</p>
            <h3 id="assign-title">Assign a task</h3>
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose} disabled={pending}>×</button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="task-title">Task title</label>
          <input
            id="task-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Validate the release checklist"
            autoFocus
            disabled={pending}
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="button-secondary" onClick={onClose} disabled={pending}>Cancel</button>
            <button type="submit" className="button-primary" disabled={pending}>{pending ? 'Sending…' : 'Create task'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
