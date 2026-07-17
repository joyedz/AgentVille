import { access, cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, sep } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seedRoot = resolve(projectRoot, 'seed-project');
const workspaceRoot = resolve(projectRoot, '.agentville', 'workspaces');

export function workspacePath(agentId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(agentId)) {
    throw new Error('agentId must contain only letters, numbers, hyphens, and underscores');
  }
  const target = resolve(workspaceRoot, agentId);
  if (!target.startsWith(`${workspaceRoot}${sep}`)) {
    throw new Error('workspace path escapes the AgentVille workspace root');
  }
  return target;
}

export async function resetWorkspace(agentId: string) {
  const target = workspacePath(agentId);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(seedRoot, target, {
    recursive: true,
    filter: (source) => !source.includes('node_modules')
  });
  return target;
}

/** Return an existing workspace unchanged, or create a fresh seed copy when missing. */
export async function ensureWorkspace(agentId: string): Promise<string> {
  const target = workspacePath(agentId);
  try {
    if ((await stat(target)).isDirectory()) return target;
  } catch {
    // A missing workspace is created below.
  }
  await access(seedRoot);
  return resetWorkspace(agentId);
}
