import path from 'path';
import fs from 'fs';
import dns from 'dns';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/server-options.html#server-host
dns.setDefaultResultOrder('verbatim');

// Collect all HTML entry points
const htmlEntries = fs
  .readdirSync('.')
  .filter((file) => path.extname(file) === '.html')
  .reduce<Record<string, string>>((acc, file) => {
    acc[path.basename(file, '.html')] = path.resolve(__dirname, file);
    return acc;
  }, {});

export default defineConfig({
  build: {
    rollupOptions: {
      input: htmlEntries,
    },
  },
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@miro-ide/shared': path.resolve(__dirname, '../../shared/src'),
      '@miro-ide/terminal-embed': path.resolve(__dirname, '../../modules/terminal-embed/src'),
      '@miro-ide/sync-command': path.resolve(__dirname, '../../modules/sync-command/src'),
      '@miro-ide/mcp-client': path.resolve(__dirname, '../../modules/mcp-client/src'),
      '@miro-ide/mcp-server': path.resolve(__dirname, '../../modules/mcp-server/src'),
      '@miro-ide/file-viewer': path.resolve(__dirname, '../../modules/file-viewer/src'),
      '@miro-ide/quick-review-bot': path.resolve(__dirname, '../../modules/quick-review-bot/src'),
    },
  },
});
