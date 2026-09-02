import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer as createHttpServer } from 'node:http';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { _electron } from 'playwright-core';
import { createServer } from 'vite';
import { APP_URL, DEV_ORIGIN, WINDOW_SIZE } from '../electron/config.js';
import { checkPdfSelection } from './helpers/pdf-selection-checks.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(import.meta.url);
const metadata = JSON.parse(
  await readFile(path.join(root, 'package.json'), 'utf8'),
);
const executable =
  process.env.LOCAL_PDF_CBT_PACKAGE_PATH ||
  path.join(root, 'release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe');
const evidenceRoot = path.join(root, 'work/electron-tests');
await mkdir(evidenceRoot, { recursive: true });

for (const mode of ['dev', 'built', 'packaged']) {
  await test(
    `${mode}: shell, isolation, CSP, permissions, navigation and network`,
    { timeout: 60000 },
    async () => {
      const artifacts = await mkdtemp(path.join(evidenceRoot, `${mode}-`));
      const evidence = {
        mode,
        normalErrors: [],
        normalWarnings: [],
        pageErrors: [],
        mainErrors: [],
        securityErrors: [],
        stderr: '',
      };
      const requests = [];
      const canaryHits = [];
      const canary = createHttpServer((request, response) => {
        canaryHits.push(request.url);
        response.writeHead(200, { 'Content-Type': 'text/plain' });
        response.end('LOCAL_TEST_CANARY');
      });
      let server;
      let application;
      let applicationProcess;
      let offlineProxy;
      let securityPhase = false;
      try {
        await new Promise((resolve, reject) => {
          canary.once('error', reject);
          canary.listen(0, '127.0.0.1', resolve);
        });
        const canaryUrl = `http://127.0.0.1:${canary.address().port}`;
        assert.equal(
          await (await fetch(`${canaryUrl}/control`)).text(),
          'LOCAL_TEST_CANARY',
        );
        canaryHits.length = 0;
        if (mode === 'packaged') {
          const unavailable = createHttpServer();
          await new Promise((resolve) =>
            unavailable.listen(0, '127.0.0.1', resolve),
          );
          offlineProxy = `http://127.0.0.1:${unavailable.address().port}`;
          await new Promise((resolve) => unavailable.close(resolve));
        }
        if (mode === 'dev') {
          server = await createServer({
            root,
            configFile: path.join(root, 'vite.config.js'),
          });
          await server.listen();
        }
        const env = { ...process.env };
        delete env.ELECTRON_RUN_AS_NODE;
        application = await _electron.launch({
          executablePath:
            mode === 'packaged' ? executable : require('electron'),
          // --dev must not turn a packaged executable into a development client.
          args: [
            ...(mode === 'packaged'
              ? [
                  '--dev',
                  `--proxy-server=${offlineProxy}`,
                  '--proxy-bypass-list=<-loopback>',
                ]
              : [root, ...(mode === 'dev' ? ['--dev'] : [])]),
            `--user-data-dir=${path.join(artifacts, 'profile')}`,
          ],
          cwd: artifacts,
          env,
          chromiumSandbox: true,
          timeout: 20000,
        });
        applicationProcess = application.process();
        applicationProcess.stderr?.on('data', (data) => {
          evidence.stderr += data.toString();
        });
        application.on('console', (message) => {
          if (message.type() === 'error')
            evidence.mainErrors.push(message.text());
        });
        const page = await application.firstWindow();
        page.on('pageerror', (error) =>
          evidence.pageErrors.push(error.message),
        );
        page.on('console', (message) => {
          if (message.type() === 'error')
            (securityPhase
              ? evidence.securityErrors
              : evidence.normalErrors
            ).push(message.text());
          if (message.type() === 'warning' && !securityPhase)
            evidence.normalWarnings.push(message.text());
        });
        page.on('request', (request) => requests.push(request.url()));
        await page.waitForSelector('#runtime-status[data-state="connected"]', {
          state: 'attached',
        });
        await page.waitForLoadState('load');
        await page.reload();
        await page.waitForSelector('#runtime-status[data-state="connected"]', {
          state: 'attached',
        });
        assert.equal(page.url(), mode === 'dev' ? `${DEV_ORIGIN}/` : APP_URL);
        evidence.renderer = await page.evaluate(() => ({
          title: document.title,
          language: document.documentElement.lang,
          empty: document.querySelector('.empty-state h3').textContent,
          runtime: document.querySelector('#runtime-status').textContent,
          requireType: typeof window.require,
          processType: typeof window.process,
          bridgeKeys: Object.keys(window.localPdfCbt),
          bridgeFrozen: Object.isFrozen(window.localPdfCbt),
          infoFrozen: Object.isFrozen(window.localPdfCbt.runtimeInfo),
          controls: document.querySelectorAll(
            'button,input,canvas,iframe,webview',
          ).length,
          debugPanelPresent: Boolean(
            document.querySelector('#pdf-debug-panel'),
          ),
        }));
        evidence.shell = await page.evaluate(() => {
          const root = document.scrollingElement;
          const header = document.querySelector('.app-header');
          const main = document.querySelector('.app-main');
          const sidebar = document.querySelector('.viewer-sidebar');
          const footer = document.querySelector('.app-footer');
          const details = document.querySelector('#document-information');
          const analysisStatuses = [
            '#text-analysis-status',
            '#keyword-analysis-status',
            '#region-analysis-status',
            '#support-profile-status',
          ].map((selector) => document.querySelector(selector));
          return {
            outerClientHeight: root.clientHeight,
            outerScrollHeight: root.scrollHeight,
            outerScrollTop: root.scrollTop,
            bodyOverflowY: getComputedStyle(document.body).overflowY,
            mainOverflowY: getComputedStyle(main).overflowY,
            sidebarOverflowY: getComputedStyle(sidebar).overflowY,
            headerHeight: header.getBoundingClientRect().height,
            footerVisible:
              footer.getBoundingClientRect().bottom <= innerHeight + 1,
            detailsOpen: details.open,
            detailsSummary: details.querySelector('summary').innerText,
            analysisOutsideDetails: analysisStatuses.every(
              (status) => !details.contains(status),
            ),
            analysisVisible: analysisStatuses.every(
              (status) => status.getClientRects().length > 0,
            ),
          };
        });
        assert.equal(evidence.renderer.title, 'Local PDF CBT');
        assert.equal(evidence.renderer.language, 'ko');
        assert.match(evidence.renderer.empty, /아직 열린 PDF가 없습니다/);
        assert.ok(
          evidence.renderer.runtime.includes(metadata.devDependencies.electron),
        );
        assert.equal(evidence.renderer.requireType, 'undefined');
        assert.equal(evidence.renderer.processType, 'undefined');
        assert.deepEqual(evidence.renderer.bridgeKeys, [
          'runtimeInfo',
          'selectPdfFile',
          'inspectDroppedPdfFiles',
        ]);
        assert.equal(
          evidence.renderer.bridgeFrozen && evidence.renderer.infoFrozen,
          true,
        );
        assert.equal(evidence.renderer.controls, 12);
        assert.equal(evidence.renderer.debugPanelPresent, false);
        assert.ok(
          evidence.shell.outerScrollHeight <=
            evidence.shell.outerClientHeight + 1,
        );
        assert.equal(evidence.shell.outerScrollTop, 0);
        assert.equal(evidence.shell.bodyOverflowY, 'hidden');
        assert.equal(evidence.shell.mainOverflowY, 'hidden');
        assert.equal(evidence.shell.sidebarOverflowY, 'auto');
        assert.ok(evidence.shell.headerHeight <= 64);
        assert.equal(evidence.shell.footerVisible, true);
        assert.equal(evidence.shell.detailsOpen, false);
        assert.match(evidence.shell.detailsSummary, /문서 정보/);
        assert.equal(evidence.shell.analysisOutsideDetails, true);
        assert.equal(evidence.shell.analysisVisible, true);
        assert.equal(
          await page.locator('#pdf-page-navigation').isHidden(),
          true,
        );
        assert.equal(await page.locator('#select-pdf').isEnabled(), true);

        evidence.main = await application.evaluate(
          async ({ app, BrowserWindow }) => {
            const { readdir, readFile } =
              process.getBuiltinModule('fs').promises;
            const { createHash } = process.getBuiltinModule('crypto');
            const path = process.getBuiltinModule('path');
            const win = BrowserWindow.getAllWindows()[0];
            const prefs = win.webContents.getLastWebPreferences();
            return {
              packaged: app.isPackaged,
              version: app.getVersion(),
              versions: {
                electron: process.versions.electron,
                node: process.versions.node,
                chrome: process.versions.chrome,
              },
              appPath: app.getAppPath(),
              size: win.getSize(),
              minimum: win.getMinimumSize(),
              visible: win.isVisible(),
              nodeIntegration: prefs.nodeIntegration,
              sandbox: prefs.sandbox,
              contextIsolation: prefs.contextIsolation,
              webSecurity: prefs.webSecurity,
              webviewTag: prefs.webviewTag,
              argv: process.argv,
              roots: app.isPackaged ? await readdir(app.getAppPath()) : [],
              mainHash: createHash('sha256')
                .update(
                  await readFile(
                    path.join(app.getAppPath(), 'electron/main.js'),
                  ),
                )
                .digest('hex'),
            };
          },
        );
        assert.equal(evidence.main.packaged, mode === 'packaged');
        assert.equal(evidence.main.version, metadata.version);
        assert.equal(evidence.main.visible, true);
        assert.deepEqual(evidence.main.minimum, [
          WINDOW_SIZE.minWidth,
          WINDOW_SIZE.minHeight,
        ]);
        assert.equal(evidence.main.nodeIntegration, false);
        for (const setting of ['sandbox', 'contextIsolation', 'webSecurity'])
          assert.equal(evidence.main[setting], true);
        assert.equal(evidence.main.webviewTag, false);
        assert.ok(!evidence.main.argv.includes('--no-sandbox'));
        assert.equal(
          evidence.main.mainHash,
          createHash('sha256')
            .update(await readFile(path.join(root, 'electron/main.js')))
            .digest('hex'),
        );
        if (mode === 'packaged') {
          assert.ok(evidence.main.appPath.endsWith('resources\\app.asar'));
          assert.deepEqual(evidence.main.roots.sort(), [
            'dist',
            'electron',
            'package.json',
          ]);
          evidence.offlineControl = await application.evaluate(
            async ({ session }, { url, proxy }) => {
              const control = session.fromPartition('unit-0.4-offline-control');
              await control.setProxy({ mode: 'direct' });
              const online = await (
                await control.fetch(`${url}/offline-control`)
              ).text();
              await control.setProxy({
                mode: 'fixed_servers',
                proxyRules: proxy,
                proxyBypassRules: '<-loopback>',
              });
              await control.closeAllConnections();
              let failure;
              try {
                await control.fetch(`${url}/must-not-arrive`);
              } catch (error) {
                failure = error.message;
              }
              return {
                online,
                failure,
                appProxy: await session.defaultSession.resolveProxy(url),
              };
            },
            { url: canaryUrl, proxy: offlineProxy },
          );
          assert.equal(evidence.offlineControl.online, 'LOCAL_TEST_CANARY');
          assert.match(
            evidence.offlineControl.failure,
            /ERR_PROXY_CONNECTION_FAILED/,
          );
          assert.equal(
            evidence.offlineControl.appProxy,
            `PROXY ${new URL(offlineProxy).host}`,
          );
          assert.deepEqual(canaryHits, ['/offline-control']);
          canaryHits.length = 0;
          await application.evaluate(async ({ session }) => {
            await session.defaultSession.clearCache();
            await session.defaultSession.closeAllConnections();
          });
          await page.reload();
          await page.waitForSelector(
            '#runtime-status[data-state="connected"]',
            { state: 'attached' },
          );
          evidence.offline = await page.evaluate(() => ({
            online: navigator.onLine,
            url: location.href,
          }));
          // A dead proxy is applied to this app only; the PC's network is unchanged.
          assert.equal(evidence.offline.url, APP_URL);
          await page.screenshot({
            path: path.join(artifacts, 'offline-shell.png'),
          });
          await application.evaluate(async ({ session }) => {
            await session.defaultSession.setProxy({ mode: 'direct' });
            await session.defaultSession.closeAllConnections();
          });
        }
        await page.screenshot({ path: path.join(artifacts, 'shell.png') });
        await application.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].setSize(640, 480),
        );
        await page.waitForFunction(() => innerWidth < 640);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        assert.equal(
          await page.evaluate(() => {
            const root = document.scrollingElement;
            return (
              root.scrollTop === 0 && root.scrollHeight <= root.clientHeight + 1
            );
          }),
          true,
        );
        await page.locator('.app-footer').scrollIntoViewIfNeeded();
        assert.equal(
          await page
            .locator('.app-footer')
            .evaluate(
              (element) =>
                element.getBoundingClientRect().bottom <= innerHeight + 1,
            ),
          true,
        );
        assert.deepEqual(evidence.normalErrors, []);
        assert.deepEqual(evidence.normalWarnings, []);
        assert.deepEqual(evidence.pageErrors, []);
        assert.ok(
          requests.every((url) =>
            url.startsWith(mode === 'dev' ? DEV_ORIGIN : 'local-cbt://app/'),
          ),
        );

        evidence.pdfSelection = await checkPdfSelection(
          application,
          page,
          artifacts,
        );
        evidence.pdfAssetRequests = requests.filter(
          (url) => url.includes('pdf.worker') || url.includes('/pdfjs/'),
        );
        assert.ok(
          evidence.pdfAssetRequests.some((url) => url.includes('pdf.worker')),
        );
        assert.ok(
          evidence.pdfAssetRequests.every((url) =>
            url.startsWith(mode === 'dev' ? DEV_ORIGIN : 'local-cbt://app/'),
          ),
        );
        assert.deepEqual(evidence.normalErrors, []);
        assert.deepEqual(evidence.normalWarnings, []);
        assert.deepEqual(evidence.pageErrors, []);

        // Rejected probes intentionally produce CSP console diagnostics; keep them separate.
        securityPhase = true;
        await page.evaluate(() => {
          window.unit04Violations = [];
          document.addEventListener('securitypolicyviolation', (event) =>
            window.unit04Violations.push(event.effectiveDirective),
          );
          const script = document.createElement('script');
          script.textContent = 'window.unit04InlineExecuted = true';
          document.body.append(script);
        });
        await page.waitForFunction(() =>
          window.unit04Violations.includes('script-src-elem'),
        );
        assert.equal(
          await page.evaluate(() => window.unit04InlineExecuted),
          undefined,
        );
        if (mode !== 'dev') {
          await page.evaluate(() => {
            const style = document.createElement('style');
            style.textContent =
              'body { background: rgb(255, 0, 0) !important; }';
            document.body.append(style);
          });
          await page.waitForFunction(() =>
            window.unit04Violations.includes('style-src-elem'),
          );
          assert.notEqual(
            await page.evaluate(
              () => getComputedStyle(document.body).backgroundColor,
            ),
            'rgb(255, 0, 0)',
          );
        }
        evidence.rendererFetchBlocked = await page.evaluate(async (url) => {
          try {
            await fetch(url);
            return false;
          } catch {
            return true;
          }
        }, `${canaryUrl}/renderer`);
        assert.equal(evidence.rendererFetchBlocked, true);
        // net.fetch uses the real default session, so this checks the network allowlist separately from CSP.
        evidence.sessionFetchBlocked = await application.evaluate(
          async ({ net }, url) => {
            try {
              await net.fetch(url);
              return false;
            } catch {
              return true;
            }
          },
          `${canaryUrl}/session`,
        );
        assert.equal(evidence.sessionFetchBlocked, true);
        evidence.permissions = await page.evaluate(async () => ({
          notification: await Notification.requestPermission(),
          geolocation: await new Promise((resolve) =>
            navigator.geolocation.getCurrentPosition(
              () => resolve('allowed'),
              (error) => resolve(error.code),
              { timeout: 2000 },
            ),
          ),
        }));
        assert.equal(evidence.permissions.notification, 'denied');
        assert.equal(evidence.permissions.geolocation, 1);
        assert.equal(
          await page.evaluate((url) => window.open(url) === null, canaryUrl),
          true,
        );
        assert.equal(application.windows().length, 1);
        evidence.navigationBlocked = await application.evaluate(
          ({ BrowserWindow }, url) =>
            new Promise((resolve) => {
              const contents = BrowserWindow.getAllWindows()[0].webContents;
              const cleanup = () => {
                contents.off('will-frame-navigate', onNavigate);
                contents.off('will-navigate', onNavigate);
              };
              const timeout = setTimeout(() => {
                cleanup();
                resolve(false);
              }, 2000);
              const onNavigate = (event) => {
                clearTimeout(timeout);
                cleanup();
                resolve(event.defaultPrevented);
              };
              contents.once('will-frame-navigate', onNavigate);
              contents.once('will-navigate', onNavigate);
              void contents.executeJavaScript(
                `location.href = ${JSON.stringify(url)}`,
              );
            }),
          `${canaryUrl}/navigation`,
        );
        assert.equal(evidence.navigationBlocked, true);
        assert.equal(page.url(), mode === 'dev' ? `${DEV_ORIGIN}/` : APP_URL);
        const localCanary = path.join(artifacts, 'outside.html');
        await writeFile(localCanary, '<title>SHOULD_NOT_OPEN</title>');
        await page.evaluate((url) => {
          location.href = url;
        }, pathToFileURL(localCanary).href);
        evidence.fileNavigation = {
          title: await page.title(),
          url: page.url(),
          text: (await page.locator('body').innerText()).slice(0, 200),
        };
        assert.equal(page.url(), mode === 'dev' ? `${DEV_ORIGIN}/` : APP_URL);
        assert.match(evidence.fileNavigation.text, /아직 열린 PDF가 없습니다/);
        assert.ok(!evidence.fileNavigation.text.includes('SHOULD_NOT_OPEN'));

        if (mode !== 'dev') {
          evidence.assetProbes = await application.evaluate(async ({ net }) => {
            const results = [];
            for (const [suffix, expected] of [
              ['index.html', 200],
              ['pdfjs/cmaps/78-EUC-H.bcmap', 200],
              ['pdfjs/iccs/CGATS001Compat-v2-micro.icc', 200],
              ['pdfjs/standard_fonts/LiberationSans-Regular.ttf', 200],
              ['pdfjs/wasm/openjpeg.wasm', 200],
              ['%2e%2e%2fpackage.json', 403],
              ['bad%5cfile.js', 403],
              ['package.json', 403],
              ['missing.js', 404],
              ['%E0%A4%A.js', 400],
            ]) {
              const response = await net.fetch(`local-cbt://app/${suffix}`);
              results.push({ suffix, expected, actual: response.status });
            }
            return results;
          });
          for (const probe of evidence.assetProbes)
            assert.equal(probe.actual, probe.expected, probe.suffix);
        }
        evidence.cspViolations = await page.evaluate(
          () => window.unit04Violations,
        );
        assert.deepEqual(canaryHits, []);
        assert.deepEqual(evidence.pageErrors, []);
        assert.deepEqual(evidence.mainErrors, []);
        assert.ok(
          evidence.securityErrors.every((error) =>
            /Content Security Policy|Not allowed to load local resource|net::ERR_BLOCKED_BY_CLIENT/.test(
              error,
            ),
          ),
          evidence.securityErrors.join('\n'),
        );
        evidence.result = 'passed';
      } catch (error) {
        evidence.failure = {
          message: error.message,
          stack: error.stack,
        };
        throw error;
      } finally {
        try {
          await application?.close();
        } catch (error) {
          evidence.cleanupError = error.message;
        }
        await server?.close();
        await new Promise((resolve) => canary.close(resolve));
        evidence.exitCode = applicationProcess?.exitCode;
        await writeFile(
          path.join(artifacts, 'result.json'),
          JSON.stringify(evidence, null, 2),
        );
        console.log(`Evidence: ${path.relative(root, artifacts)}`);
      }
      assert.equal(evidence.exitCode, 0);
      assert.equal(evidence.cleanupError, undefined);
      assert.deepEqual(evidence.mainErrors, []);
      assert.ok(
        !/ERROR:|FATAL:|Application startup failed|UnhandledPromiseRejection/.test(
          evidence.stderr,
        ),
        evidence.stderr,
      );
    },
  );
}
