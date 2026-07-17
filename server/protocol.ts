import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);

export const agentStatusSchema = z.enum([
  'working',
  'idle',
  'blocked',
  'error',
  'paused',
  'stopped'
]);

export const zoneSchema = z.enum(['desk', 'coffee', 'lounge', 'attention']);

export const commandTypeSchema = z.enum([
  'approve',
  'pause',
  'resume',
  'stop',
  'assign_task',
  'add_instruction'
]);

const commandStatusSchema = z.enum(['pending', 'acknowledged', 'done', 'failed']);

const commandPayloadSchema = z
  .object({
    taskTitle: nonEmptyString.optional(),
    instruction: nonEmptyString.optional()
  })
  .optional();

export const agentSchema = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  role: nonEmptyString,
  status: agentStatusSchema,
  zone: zoneSchema,
  x: z.number(),
  y: z.number(),
  currentTaskId: nonEmptyString.optional(),
  checkpoint: nonEmptyString.optional(),
  lastUpdated: nonEmptyString
});

export const commandSchema = z.object({
  id: nonEmptyString,
  agentId: nonEmptyString,
  type: commandTypeSchema,
  payload: commandPayloadSchema,
  status: commandStatusSchema,
  createdAt: nonEmptyString
});

export type AgentStatus = z.infer<typeof agentStatusSchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type CommandType = z.infer<typeof commandTypeSchema>;
export type Agent = z.infer<typeof agentSchema>;
export type Command = z.infer<typeof commandSchema>;

export const commandRequestSchema = z.object({
  id: nonEmptyString,
  type: commandTypeSchema,
  payload: commandPayloadSchema
});

export type CommandRequest = z.infer<typeof commandRequestSchema>;
