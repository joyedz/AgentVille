import { buildApp } from './app.js';

const app = buildApp();

try {
  const address = await app.listen({ host: '127.0.0.1', port: 8787 });
  console.info(`[agentville:server] listening at ${address}`);
} catch (error) {
  console.error('[agentville:server] failed to start', error);
  process.exit(1);
}
