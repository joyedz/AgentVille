import { expect, test } from 'vitest';

test('buildApp is exported from the server app module', async () => {
  const appModule = await import('../app.js');

  expect(typeof appModule.buildApp).toBe('function');
});
