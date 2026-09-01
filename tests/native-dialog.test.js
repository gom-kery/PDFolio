import assert from 'node:assert/strict';
import { test } from 'node:test';
import { _electron } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPdfFixtures } from './helpers/pdf-fixtures.js';

const root = fileURLToPath(new URL('..', import.meta.url));
test(
  'packaged Windows picker selects a Unicode PDF and cancel preserves selection',
  { timeout: 60000 },
  async () => {
    const evidenceRoot = path.join(root, 'work/native-dialog-tests');
    await mkdir(evidenceRoot, { recursive: true });
    const artifacts = await mkdtemp(path.join(evidenceRoot, 'case-'));
    const files = await createPdfFixtures(path.join(artifacts, 'inputs'));
    const hash = () =>
      readFile(files.valid).then((bytes) =>
        createHash('sha256').update(bytes).digest('hex'),
      );
    const before = await hash();
    const evidence = {
      rendererErrors: [],
      mainErrors: [],
      stderr: '',
      nativeActions: [],
    };
    let application;
    let applicationProcess;
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    try {
      application = await _electron.launch({
        executablePath:
          process.env.LOCAL_PDF_CBT_PACKAGE_PATH ||
          path.join(root, 'release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe'),
        args: [`--user-data-dir=${path.join(artifacts, 'profile')}`],
        env,
        chromiumSandbox: true,
      });
      applicationProcess = application.process();
      applicationProcess.stderr.on('data', (data) => {
        evidence.stderr += data;
      });
      application.on('console', (message) => {
        if (message.type() === 'error')
          evidence.mainErrors.push(message.text());
      });
      const page = await application.firstWindow();
      page.on('console', (message) => {
        if (message.type() === 'error')
          evidence.rendererErrors.push(message.text());
      });
      page.on('pageerror', (error) =>
        evidence.rendererErrors.push(error.message),
      );
      await page.waitForSelector('#runtime-status[data-state="connected"]');
      evidence.ownerProcessId = await application.evaluate(() => process.pid);
      evidence.launchedProcessId = applicationProcess.pid;
      console.log(
        `Native owner PID: ${evidence.ownerProcessId}, launcher PID: ${evidence.launchedProcessId}`,
      );
      // Keep the real native dialog, but start in this test's own folder for privacy.
      await application.evaluate(({ dialog }, directory) => {
        const original = dialog.showOpenDialog.bind(dialog);
        dialog.showOpenDialog = (owner, options) =>
          original(owner, { ...options, defaultPath: directory });
      }, path.dirname(files.valid));
      for (const action of ['select', 'cancel']) {
        const helper = spawn(
          'powershell.exe',
          [
            '-NoProfile',
            '-File',
            path.join(root, 'tests/helpers/native-dialog.ps1'),
            '-OwnerProcessId',
            String(evidence.ownerProcessId),
            '-Action',
            action,
            '-FilePath',
            files.valid,
          ],
          { windowsHide: true },
        );
        let helperOutput = '';
        helper.stdout.on('data', (data) => {
          helperOutput += data;
        });
        helper.stderr.on('data', (data) => {
          helperOutput += data;
        });
        const done = new Promise((resolve, reject) => {
          helper.once('error', reject);
          helper.once('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(helperOutput)),
          );
        });
        // Attach rejection handling before UI work so a failed helper cannot become unhandled.
        const actionResult = done.then(
          () => null,
          (error) => error,
        );
        await page.locator('#select-pdf').click();
        const failure = await actionResult;
        if (failure) throw failure;
        await page.waitForFunction(
          (expected) =>
            document.querySelector('#selection-status').dataset.state ===
            expected,
          action === 'select' ? 'selected' : 'canceled',
        );
        assert.equal(
          await page.locator('#selected-file-name').innerText(),
          '한글 문서 & 연습.PDF',
        );
        evidence.nativeActions.push({ action, result: 'passed' });
      }
      evidence.originalHashUnchanged = before === (await hash());
      assert.equal(evidence.originalHashUnchanged, true);
      await page.screenshot({
        path: path.join(artifacts, 'native-selection.png'),
        fullPage: true,
      });
      assert.deepEqual(evidence.rendererErrors, []);
      assert.deepEqual(evidence.mainErrors, []);
    } finally {
      await application?.close();
      evidence.exitCode = applicationProcess?.exitCode;
      await writeFile(
        path.join(artifacts, 'result.json'),
        JSON.stringify(evidence, null, 2),
      );
      console.log(`Native picker evidence: ${path.relative(root, artifacts)}`);
    }
    assert.equal(evidence.exitCode, 0);
    assert.ok(!/ERROR:|FATAL:/.test(evidence.stderr), evidence.stderr);
  },
);
