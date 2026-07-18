import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/ws': {
        target: 'ws://127.0.0.1:8787',
        ws: true,
        configure: (proxy) => {
          proxy.on('proxyReqWs', (_proxyRequest, request) => {
            console.info('[agentville:ws-proxy] forwarding upgrade', {
              path: request.url,
              target: 'ws://127.0.0.1:8787/ws'
            });
          });
          proxy.on('open', () => {
            console.info('[agentville:ws-proxy] upstream socket opened');
          });
          proxy.on('close', () => {
            console.info('[agentville:ws-proxy] upstream socket closed');
          });
          proxy.on('error', (error, request) => {
            console.error('[agentville:ws-proxy] upstream socket error', {
              message: error.message,
              code: (error as NodeJS.ErrnoException).code,
              path: request?.url
            });
          });
        }
      }
    }
  }
});
