import { access, rm, writeFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { resetWorkspace } from '../workspaces.js';

it('resets an agent workspace from the seed project', async () => {
  const agentId = `test-${Date.now()}`;
  const target = await resetWorkspace(agentId);

  try {
    await writeFile(`${target}/stale.txt`, 'remove me');
    await resetWorkspace(agentId);
    await expect(access(`${target}/package.json`)).resolves.toBeUndefined();
    await expect(access(`${target}/src/format.ts`)).resolves.toBeUndefined();
    await expect(access(`${target}/stale.txt`)).rejects.toThrow();
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
