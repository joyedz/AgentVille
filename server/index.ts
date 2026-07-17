import { buildApp } from './app.js';

const app = buildApp();

try {
  await app.listen({ host: '127.0.0.1', port: 8787 });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
