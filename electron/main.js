import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  protocol,
  session,
} from 'electron';
import path from 'node:path';
import { access } from 'node:fs/promises';
import {
  APP_NAME,
  APP_SCHEME,
  APP_URL,
  DEV_ORIGIN,
  WINDOW_SIZE,
} from './config.js';
import { registerLocalProtocol } from './local-protocol.js';
import { isAllowedRequest } from './security.js';
import {
  createPdfSelectionHandler,
  PDF_SELECTION_CHANNEL,
} from './pdf-selection.js';
import { createPdfDropHandler, PDF_DROP_CHANNEL } from './pdf-drop.js';
import { createPdfInputGate } from './pdf-input.js';

const isDevelopment = !app.isPackaged && process.argv.includes('--dev');
const rendererUrl = isDevelopment ? `${DEV_ORIGIN}/` : APP_URL;

app.setName(APP_NAME);
protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true } },
]);

/** Create the application shell with an isolated renderer. */
async function createWindow() {
  const window = new BrowserWindow({
    ...WINDOW_SIZE,
    title: APP_NAME,
    show: false,
    backgroundColor: '#f4f6f5',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'electron', 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-frame-navigate', (event) =>
    event.preventDefault(),
  );
  window.webContents.on('will-redirect', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) =>
    event.preventDefault(),
  );

  const runPdfInputExclusive = createPdfInputGate();
  ipcMain.handle(
    PDF_SELECTION_CHANNEL,
    createPdfSelectionHandler({
      window,
      rendererUrl,
      showOpenDialog: (...args) => dialog.showOpenDialog(...args),
      runExclusive: runPdfInputExclusive,
    }),
  );
  ipcMain.handle(
    PDF_DROP_CHANNEL,
    createPdfDropHandler({
      window,
      rendererUrl,
      runExclusive: runPdfInputExclusive,
    }),
  );
  window.once('closed', () => {
    ipcMain.removeHandler(PDF_SELECTION_CHANNEL);
    ipcMain.removeHandler(PDF_DROP_CHANNEL);
  });

  await window.loadURL(rendererUrl);
  window.show();
}

function reportStartupFailure(error) {
  console.error('Application startup failed.', error);
  dialog.showErrorBox(
    'Local PDF CBT 실행 실패',
    isDevelopment
      ? '개발 서버 연결을 확인해주세요. 프로젝트 폴더에서 npm run dev로 실행합니다.'
      : '빌드 파일을 확인해주세요. 개발 중에는 npm run build 후 npm start로 실행합니다.',
  );
  app.exit(1);
}

app
  .whenReady()
  .then(async () => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => {
        callback(false);
      },
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !isAllowedRequest(details.url, isDevelopment) });
    });

    if (!isDevelopment) {
      const rendererDirectory = path.join(app.getAppPath(), 'dist');
      // A protocol 404 can still finish navigation successfully; fail before showing a blank shell.
      await access(path.join(rendererDirectory, 'index.html'));
      registerLocalProtocol(protocol, rendererDirectory);
    }

    await createWindow();
  })
  .catch(reportStartupFailure);

app.on('window-all-closed', () => app.quit());
