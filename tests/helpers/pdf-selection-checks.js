import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createPdfFixtures } from './pdf-fixtures.js';

/** Use controlled native-dialog results, but real IPC, filesystem checks and renderer UI. */
export async function checkPdfSelection(application, page, artifacts) {
  const files = await createPdfFixtures(path.join(artifacts, 'pdf-inputs'));
  const hash = async () =>
    createHash('sha256')
      .update(await readFile(files.valid))
      .digest('hex');
  const originalHash = await hash();
  await application.evaluate(({ dialog }) => {
    globalThis.unit11OriginalDialog = dialog.showOpenDialog;
    globalThis.unit11DialogCalls = 0;
    dialog.showOpenDialog = async (owner, options) => {
      globalThis.unit11DialogCalls++;
      globalThis.unit11DialogOptions = { parent: owner.getTitle(), ...options };
      if (globalThis.unit11DialogPlan.wait)
        return new Promise((resolve) => {
          globalThis.unit11ResolveDialog = resolve;
        });
      if (globalThis.unit11DialogPlan.fail)
        throw new Error('Private native error must not escape');
      return globalThis.unit11DialogPlan;
    };
  });
  const select = async (plan, state) => {
    await application.evaluate((_electron, value) => {
      globalThis.unit11DialogPlan = value;
    }, plan);
    await page.locator('#select-pdf').click();
    await page.waitForSelector(`#selection-status[data-state="${state}"]`);
    assert.equal(await page.locator('#select-pdf').isEnabled(), true);
  };
  try {
    const foreignRequest = await application.evaluate(
      async ({ app, BrowserWindow }) => {
        const path = process.getBuiltinModule('path');
        const url = BrowserWindow.getAllWindows()[0].webContents.getURL();
        const other = new BrowserWindow({
          show: false,
          webPreferences: {
            preload: path.join(app.getAppPath(), 'electron/preload.cjs'),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
          },
        });
        try {
          await other.loadURL(url);
          return await other.webContents.executeJavaScript(
            'window.localPdfCbt.selectPdfFile()',
          );
        } finally {
          other.destroy();
        }
      },
    );
    assert.deepEqual(foreignRequest, {
      status: 'error',
      code: 'INVALID_REQUEST',
    });
    assert.equal(
      await application.evaluate(() => globalThis.unit11DialogCalls),
      0,
    );
    await select({ canceled: true, filePaths: [] }, 'canceled');
    assert.equal(
      await page.locator('#selected-file-name').innerText(),
      '선택한 파일 없음',
    );
    await select({ canceled: false, filePaths: [files.valid] }, 'selected');
    assert.equal(
      await page.locator('#selected-file-name').innerText(),
      '한글 문서 & 연습.PDF',
    );
    assert.match(
      await page.locator('#selected-file-size').innerText(),
      /바이트/,
    );
    assert.match(
      await page.locator('#document-description').innerText(),
      /손상·암호 확인은 아직 지원하지 않습니다/,
    );
    assert.ok(
      !(await page.locator('body').innerText()).includes(
        path.dirname(files.valid),
      ),
    );
    assert.equal(await hash(), originalHash);
    await page.screenshot({
      path: path.join(artifacts, 'selected-pdf.png'),
      fullPage: true,
    });
    const cases = [];
    for (const [name, message] of [
      ['renamed', '기본 파일 서명'],
      ['text', 'PDF 확장자'],
      ['empty', '내용이 없는'],
      ['short', '기본 파일 서명'],
      ['oversized', '50 MiB 이하'],
    ]) {
      await select({ canceled: false, filePaths: [files[name]] }, 'error');
      assert.ok(
        (await page.locator('#selection-status').innerText()).includes(message),
      );
      assert.equal(
        await page.locator('#selected-file-name').innerText(),
        '한글 문서 & 연습.PDF',
      );
      cases.push(name);
    }
    await page.screenshot({
      path: path.join(artifacts, 'selection-error.png'),
      fullPage: true,
    });
    let nativeAccessDenied = false;
    if (await application.evaluate(({ app }) => app.isPackaged)) {
      const helper = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-File',
          fileURLToPath(new URL('./deny-file-read.ps1', import.meta.url)),
          '-FilePath',
          files.valid,
        ],
        { windowsHide: true },
      );
      let errorText = '';
      helper.stderr.on('data', (data) => {
        errorText += data;
      });
      const finished = new Promise((resolve) =>
        helper.once('exit', (code) => resolve(code)),
      );
      try {
        await new Promise((resolve, reject) => {
          helper.once('error', reject);
          helper.stdout.on('data', (data) => {
            if (data.toString().includes('READY')) resolve();
          });
          helper.once('exit', () =>
            reject(
              new Error(
                errorText || 'Permission fixture helper exited before ready',
              ),
            ),
          );
        });
        await select({ canceled: false, filePaths: [files.valid] }, 'error');
        assert.match(
          await page.locator('#selection-status').innerText(),
          /읽을 권한이 없습니다/,
        );
        assert.equal(
          await page.locator('#selected-file-name').innerText(),
          '한글 문서 & 연습.PDF',
        );
        nativeAccessDenied = true;
      } finally {
        helper.stdin.end('restore\n');
        assert.equal(await finished, 0, errorText);
      }
      assert.equal(await hash(), originalHash);
    }
    await select(
      { canceled: false, filePaths: [path.join(artifacts, 'missing.pdf')] },
      'error',
    );
    assert.match(
      await page.locator('#selection-status').innerText(),
      /찾을 수 없습니다/,
    );
    await select({ fail: true }, 'error');
    assert.ok(
      !(await page.locator('body').innerText()).includes(
        'Private native error',
      ),
    );
    await select({ canceled: true, filePaths: [] }, 'canceled');
    assert.match(
      await page.locator('#selection-status').innerText(),
      /이전 선택을 유지/,
    );

    await application.evaluate(() => {
      globalThis.unit11DialogPlan = { wait: true };
    });
    await page.locator('#select-pdf').click();
    await page.waitForSelector('#selection-status[data-state="selecting"]');
    assert.equal(await page.locator('#select-pdf').isDisabled(), true);
    assert.deepEqual(
      await page.evaluate(() => window.localPdfCbt.selectPdfFile()),
      { status: 'busy' },
    );
    await application.evaluate((_electron, file) => {
      globalThis.unit11ResolveDialog({ canceled: false, filePaths: [file] });
    }, files.replacement);
    await page.waitForFunction(
      () =>
        document.querySelector('#selected-file-name').textContent ===
        '다른 문서.pdf',
    );
    const options = await application.evaluate(
      () => globalThis.unit11DialogOptions,
    );
    assert.equal(options.parent, 'Local PDF CBT');
    assert.deepEqual(options.properties, ['openFile', 'dontAddToRecent']);
    assert.deepEqual(options.filters, [
      { name: 'PDF 문서', extensions: ['pdf'] },
    ]);
    assert.equal(await hash(), originalHash);
    await page.reload();
    await page.waitForSelector('#runtime-status[data-state="connected"]');
    assert.equal(
      await page.locator('#selected-file-name').innerText(),
      '선택한 파일 없음',
    );
    return {
      cases,
      originalHashUnchanged: true,
      nativeAccessDenied,
      foreignWindowBlocked: true,
      canceledAndFailedSelectionPreserved: true,
      concurrentRequest: 'busy',
      reloadedSelection: 'empty',
      dialog: 'controlled results; actual native picker checked separately',
    };
  } finally {
    await application.evaluate(({ dialog }) => {
      dialog.showOpenDialog = globalThis.unit11OriginalDialog;
      delete globalThis.unit11OriginalDialog;
      delete globalThis.unit11DialogPlan;
      delete globalThis.unit11ResolveDialog;
    });
  }
}
