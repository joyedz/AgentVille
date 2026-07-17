import { access, rm, writeFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { ensureWorkspace, resetWorkspace } from '../workspaces.js';

it('resets an agent workspace from the seed project', async () => {
  const agentId = `test-${Date.now()}`;
  const target = await resetWorkspace(agentId);

  try {
    await writeFile(`${target}/stale.txt`, 'remove me');
    await resetWorkspace(agentId);
    await expect(access(`${target}/package.json`)).resolves.toBeUndefined();
    await expect(access(`${target}/src/format.ts`)).resolves.toBeUndefined();
    await expect(access(`${target}/vitest.config.ts`)).resolves.toBeUndefined();
    await expect(access(`${target}/stale.txt`)).rejects.toThrow();
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

it('rejects traversal-shaped agent ids before touching the filesystem', async () => {
  await expect(resetWorkspace('../escape')).rejects.toThrow(/agentId/);
});

it('preserves an existing workspace while recreating a missing one', async () => {
  const agentId = `ensure-${Date.now()}`;
  const target = await resetWorkspace(agentId);

  try {
    await writeFile(`${target}/keep.txt`, 'keep me');
    await expect(ensureWorkspace(agentId)).resolves.toBe(target);
    await expect(access(`${target}/keep.txt`)).resolves.toBeUndefined();
    await rm(target, { recursive: true, force: true });
    await expect(ensureWorkspace(agentId)).resolves.toBe(target);
    await expect(access(`${target}/package.json`)).resolves.toBeUndefined();
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
