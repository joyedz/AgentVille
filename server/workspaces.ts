import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

export async function resetWorkspace(agentId: string) {
  const target = join('.agentville', 'workspaces', agentId);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp('seed-project', target, {
    recursive: true,
    filter: (source) => !source.includes('node_modules')
  });
  return target;
}
