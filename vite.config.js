import { defineConfig, normalizePath } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import {
  createContentSecurityPolicy,
  DEV_HOST,
  DEV_PORT,
} from './electron/config.js';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const pdfJsDirectory = path.join(projectRoot, 'node_modules', 'pdfjs-dist');
const generatedPublicDirectory = path.join(projectRoot, 'work', 'pdfjs-public');

async function preparePdfAssets() {
  const target = path.join(generatedPublicDirectory, 'pdfjs');
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await Promise.all(
    ['cmaps', 'iccs', 'standard_fonts', 'wasm'].map((directory) =>
      cp(path.join(pdfJsDirectory, directory), path.join(target, directory), {
        recursive: true,
      }),
    ),
  );
  await copyFile(
    path.join(pdfJsDirectory, 'LICENSE'),
    path.join(target, 'LICENSE'),
  );
}
// Anchor exclusions to this project, so an ancestor named "work" is still usable.
const privateDirectories = [
  '.git',
  'docs',
  'work',
  '.local-data',
  'release',
].map((directory) => `${normalizePath(path.join(projectRoot, directory))}/**`);

export default defineConfig(async () => {
  await preparePdfAssets();
  return {
    root: projectRoot,
    base: './',
    publicDir: generatedPublicDirectory,
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
  };
});
