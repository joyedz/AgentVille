import { DatabaseSync } from 'node:sqlite';
import type { Command, CommandType } from './protocol.js';

export type CommandInput = {
  id: string;
  agentId: string;
  type: CommandType;
  payload?: Command['payload'];
};

type CommandRow = {
  id: string;
  agent_id: string;
  type: string;
  payload: string | null;
  status: string;
  created_at: string;
};

function copyCommand(command: Command): Command {
  return {
    ...command,
    payload: command.payload ? { ...command.payload } : undefined
  };
}

function decodeRow(row: CommandRow): Command {
  const payload = row.payload === null ? undefined : JSON.parse(row.payload) as Command['payload'];
  return {
    id: row.id,
    agentId: row.agent_id,
    type: row.type as CommandType,
    payload,
    status: row.status as Command['status'],
    createdAt: row.created_at
  };
}

/** An idempotent FIFO queue whose ordering is maintained independently per agent. */
export class CommandQueue {
  private readonly byId = new Map<string, Command>();
  private readonly pending = new Map<string, Command[]>();
  private readonly insertStatement;
  private readonly acknowledgeStatement;

  constructor(private readonly database?: DatabaseSync) {
    this.insertStatement = database?.prepare(
      'INSERT OR IGNORE INTO commands (id, agent_id, type, payload, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    this.acknowledgeStatement = database?.prepare(
      "UPDATE commands SET status = 'acknowledged' WHERE id = ?"
    );
    if (database) {
      const rows = database.prepare(
        'SELECT id, agent_id, type, payload, status, created_at FROM commands ORDER BY rowid ASC'
      ).all() as unknown as CommandRow[];
      for (const row of rows) {
        const command = decodeRow(row);
        this.byId.set(command.id, command);
        if (command.status === 'pending') this.addPending(command);
      }
    }
  }

  enqueue(input: CommandInput): Command {
    const existing = this.byId.get(input.id);
    if (existing) return existing;

    const command: Command = {
      ...input,
      payload: input.payload ? { ...input.payload } : undefined,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    const result = this.insertStatement?.run(
      command.id,
      command.agentId,
      command.type,
      command.payload === undefined ? null : JSON.stringify(command.payload),
      command.status,
      command.createdAt
    );

    if (this.database && result && Number(result.changes) === 0) {
      const canonical = this.database.prepare(
        'SELECT id, agent_id, type, payload, status, created_at FROM commands WHERE id = ?'
      ).get(command.id) as unknown as CommandRow | undefined;
      if (canonical) {
        const saved = decodeRow(canonical);
        this.byId.set(saved.id, saved);
        if (saved.status === 'pending') this.addPending(saved);
        return saved;
      }
    }

    this.byId.set(command.id, command);
    this.addPending(command);
    return command;
  }

  take(agentId: string): Command | undefined {
    const agentCommands = this.pending.get(agentId);
    if (!agentCommands || agentCommands.length === 0) return undefined;

    const command = agentCommands.shift()!;
    if (agentCommands.length === 0) this.pending.delete(agentId);
    command.status = 'acknowledged';
    this.acknowledgeStatement?.run(command.id);
    return copyCommand(command);
  }

  /** Return state records that are visible in the control-plane snapshot. */
  list(): Command[] {
    return [...this.byId.values()]
      .filter((command) => command.status === 'pending' || command.status === 'acknowledged')
      .map(copyCommand);
  }

  private addPending(command: Command): void {
    const commands = this.pending.get(command.agentId) ?? [];
    commands.push(command);
    this.pending.set(command.agentId, commands);
  }
}
