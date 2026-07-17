import { expect, test } from 'vitest';

test('buildApp is exported from the server app module', async () => {
  const appModule = await import('../app.js');

  expect(typeof appModule.buildApp).toBe('function');

  const app = appModule.buildApp();
  expect(typeof app.listen).toBe('function');
  expect(typeof app.close).toBe('function');

  await app.close();
});
