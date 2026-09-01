import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';
import { createServer } from 'vite';
import { DEV_ORIGIN } from '../electron/config.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
let server;
let child;
let isStopping = false;

/** Stop the server when Electron closes or development is interrupted. */
async function stop(exitCode) {
  if (isStopping) return;
  isStopping = true;
  if (child && child.exitCode === null) child.kill();
  await server?.close();
  process.exitCode = exitCode;
}

process.once('SIGINT', () => void stop(0));
process.once('SIGTERM', () => void stop(0));

try {
  server = await createServer({ root: projectRoot });
  if (!isStopping) await server.listen();
  // An interrupt during startup must not create a late Electron process.
  if (isStopping) {
    await server.close();
  } else {
    console.log(`Local PDF CBT development server: ${DEV_ORIGIN}`);
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    child = spawn(electronPath, [projectRoot, '--dev'], {
      cwd: projectRoot,
      env,
      stdio: 'inherit',
      // Electron is the user-facing GUI, not a background console helper.
      windowsHide: false,
    });
    child.once('exit', (code) => void stop(code ?? 1));
    child.once('error', (error) => {
      console.error('Electron could not be started.', error);
      void stop(1);
    });
  }
} catch (error) {
  console.error('Development startup failed.', error);
  await stop(1);
}
