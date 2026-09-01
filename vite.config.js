import { defineConfig, normalizePath } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createContentSecurityPolicy,
  DEV_HOST,
  DEV_PORT,
} from './electron/config.js';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
// Anchor exclusions to this project, so an ancestor named "work" is still usable.
const privateDirectories = [
  '.git',
  'docs',
  'work',
  '.local-data',
  'release',
].map((directory) => `${normalizePath(path.join(projectRoot, directory))}/**`);

export default defineConfig({
  root: projectRoot,
  base: './',
  publicDir: false,
  server: {
    host: DEV_HOST,
    port: DEV_PORT,
    strictPort: true,
    open: false,
    cors: false,
    // Generated packages and local test/profile data are not renderer sources.
    watch: { ignored: privateDirectories },
    headers: {
      'Content-Security-Policy': createContentSecurityPolicy(true),
    },
    fs: {
      strict: true,
      allow: [projectRoot],
      deny: ['.env', '.env.*', '*.{crt,pem}', ...privateDirectories],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
