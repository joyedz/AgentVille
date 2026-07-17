import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'server',
          include: ['server/**/*.test.ts'],
          environment: 'node'
        }
      },
      {
        extends: true,
        test: {
          name: 'web',
          include: ['web/**/*.test.{ts,tsx}'],
          environment: 'jsdom'
        }
      },
      {
        extends: true,
        test: {
          name: 'seed-project',
          include: ['seed-project/**/*.test.ts'],
          environment: 'node'
        }
      }
    ]
  }
});
