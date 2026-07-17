import type { Command, CommandType } from './protocol.js';

export type CommandInput = {
  id: string;
  agentId: string;
  type: CommandType;
  payload?: Command['payload'];
};

/** An idempotent FIFO queue whose ordering is maintained independently per agent. */
export class CommandQueue {
  private readonly byId = new Map<string, Command>();
  private readonly pending = new Map<string, Command[]>();

  enqueue(input: CommandInput): Command {
    const existing = this.byId.get(input.id);
    if (existing) {
      return existing;
    }

    const command: Command = {
      ...input,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.byId.set(command.id, command);
    const agentCommands = this.pending.get(command.agentId) ?? [];
    agentCommands.push(command);
    this.pending.set(command.agentId, agentCommands);
    return command;
  }

  take(agentId: string): Command | undefined {
    const agentCommands = this.pending.get(agentId);
    if (!agentCommands || agentCommands.length === 0) {
      return undefined;
    }

    const command = agentCommands.shift();
    if (agentCommands.length === 0) {
      this.pending.delete(agentId);
    }
    return command;
  }
}
