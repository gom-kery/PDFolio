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
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1120, 760),
  );
  await page.waitForFunction(() => innerWidth > 1000);
  const hash = async (file = files.valid) =>
    createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  const originalHash = await hash();
  const replacementHash = await hash(files.replacement);
  const multipageHash = await hash(files.multipage);
  const dispatchDrop = async ({ filePaths = [], items = [] }) => {
    const box = await page.locator('.workspace').boundingBox();
    assert.ok(box);
    const session = await page.context().newCDPSession(page);
    const data = {
      items,
      files: filePaths,
      dragOperationsMask: 1,
    };
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    try {
      await session.send('Input.dispatchDragEvent', {
        type: 'dragEnter',
        ...point,
        data,
      });
      assert.equal(
        await page.locator('.workspace').getAttribute('data-drop-state'),
        'over',
      );
      await session.send('Input.dispatchDragEvent', {
        type: 'dragOver',
        ...point,
        data,
      });
      await session.send('Input.dispatchDragEvent', {
        type: 'drop',
        ...point,
        data,
      });
    } finally {
      await session.detach();
    }
  };
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
    await page.locator('#selection-status').evaluate((element) => {
      element.dataset.state = 'test-pending';
    });
    await page.locator('#select-pdf').click();
    await page.waitForFunction(
      (expected) =>
        document.querySelector('#selection-status').dataset.state === expected,
      state,
    );
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
          return {
            picker: await other.webContents.executeJavaScript(
              'window.localPdfCbt.selectPdfFile()',
            ),
            drop: await other.webContents.executeJavaScript(
              "window.localPdfCbt.inspectDroppedPdfFiles([new File(['%PDF-1.7\\n'], 'foreign.pdf')])",
            ),
          };
        } finally {
          other.destroy();
        }
      },
    );
    assert.deepEqual(foreignRequest, {
      picker: { status: 'error', code: 'INVALID_REQUEST' },
      drop: { status: 'error', code: 'INVALID_REQUEST' },
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
      /PDF를 표시했습니다/,
    );
    const renderedPage = await page.evaluate(() => {
      const canvas = document.querySelector('#pdf-canvas');
      const context = canvas.getContext('2d');
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      let coloredSamples = 0;
      for (let index = 0; index < pixels.length; index += 4 * 97) {
        if (
          pixels[index + 3] > 0 &&
          (pixels[index] < 240 ||
            pixels[index + 1] < 240 ||
            pixels[index + 2] < 240)
        )
          coloredSamples++;
      }
      return {
        width: canvas.width,
        height: canvas.height,
        hidden: canvas.hidden,
        coloredSamples,
        page: document.querySelector('#pdf-page-count').textContent,
        status: document.querySelector('#viewer-status').textContent,
        statusHidden: document.querySelector('#viewer-status').hidden,
        selectionHidden: document.querySelector('#selection-status').hidden,
        footer: document.querySelector('#footer-status').textContent,
      };
    });
    assert.equal(renderedPage.hidden, false);
    assert.ok(renderedPage.width > 400 && renderedPage.height > 500);
    assert.ok(renderedPage.coloredSamples > 100);
    assert.equal(renderedPage.page, '1 / 1');
    assert.equal(renderedPage.status, '');
    assert.equal(renderedPage.statusHidden, true);
    assert.equal(renderedPage.selectionHidden, true);
    assert.equal(
      renderedPage.footer,
      'PDF를 열었습니다. 원본 파일은 변경하지 않았습니다.',
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

    await select({ canceled: false, filePaths: [files.multipage] }, 'selected');
    assert.equal(await page.locator('#pdf-page-count').innerText(), '1 / 5');
    assert.equal(await page.locator('#page-number').inputValue(), '1');
    assert.equal(await page.locator('#first-page').isDisabled(), true);
    assert.equal(await page.locator('#previous-page').isDisabled(), true);

    const layout = await page.evaluate(() => {
      const stage = document.querySelector('.pdf-page-stage');
      const navigation = document.querySelector('#pdf-page-navigation');
      const sideNext = document.querySelector('#side-next-page');
      return {
        stageBottom: stage.getBoundingClientRect().bottom,
        navigationTop: navigation.getBoundingClientRect().top,
        sideNextDisplay: getComputedStyle(sideNext).display,
      };
    });
    assert.ok(layout.navigationTop >= layout.stageBottom - 1);
    assert.notEqual(layout.sideNextDisplay, 'none');
    assert.equal(await page.locator('#side-previous-page').isDisabled(), true);
    assert.equal(await page.locator('#side-next-page').isDisabled(), false);
    await page.locator('#side-next-page').click();
    await page.waitForSelector('#pdf-canvas[data-page-number="2"]');
    await page.locator('#side-previous-page').click();
    await page.waitForSelector('#pdf-canvas[data-page-number="1"]');

    const initialCanvasWidth = await page
      .locator('#pdf-canvas')
      .evaluate((canvas) => canvas.getBoundingClientRect().width);
    assert.equal(await page.locator('#zoom-level').innerText(), '100%');
    await page.locator('#zoom-in').click();
    await page.waitForSelector('#pdf-canvas[data-scale="1.25"]');
    assert.ok(
      (await page
        .locator('#pdf-canvas')
        .evaluate((canvas) => canvas.getBoundingClientRect().width)) >
        initialCanvasWidth * 1.24,
    );
    await page.evaluate(() => {
      for (let index = 0; index < 3; index++)
        document.querySelector('#zoom-in').click();
    });
    await page.waitForSelector('#pdf-canvas[data-scale="2"]');
    assert.equal(await page.locator('#zoom-in').isDisabled(), true);
    await page.evaluate(() => {
      for (let index = 0; index < 6; index++)
        document.querySelector('#zoom-out').click();
    });
    await page.waitForSelector('#pdf-canvas[data-scale="0.5"]');
    assert.equal(await page.locator('#zoom-out').isDisabled(), true);
    await page.locator('#fit-width').click();
    await page.waitForFunction(() => {
      const fit = document.querySelector('#fit-width');
      const canvas = document.querySelector('#pdf-canvas');
      return (
        fit.getAttribute('aria-pressed') === 'true' &&
        canvas.dataset.scale !== '0.5'
      );
    });
    const defaultFit = await page.evaluate(() => {
      const scroll = document.querySelector('.pdf-page-scroll');
      const canvas = document.querySelector('#pdf-canvas');
      const styles = getComputedStyle(scroll);
      const available =
        scroll.clientWidth -
        Number.parseFloat(styles.paddingLeft) -
        Number.parseFloat(styles.paddingRight);
      return {
        available,
        width: canvas.getBoundingClientRect().width,
        scale: canvas.dataset.scale,
      };
    });
    assert.ok(defaultFit.width <= defaultFit.available + 1);
    assert.ok(defaultFit.width >= defaultFit.available - 2);
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(640, 480),
    );
    await page.waitForFunction(
      (previousScale) =>
        innerWidth < 640 &&
        getComputedStyle(document.querySelector('#side-next-page')).display ===
          'none' &&
        document.querySelector('#pdf-canvas').dataset.scale !== previousScale,
      defaultFit.scale,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1120, 760),
    );
    await page.waitForFunction(
      (expectedScale) =>
        getComputedStyle(document.querySelector('#side-next-page')).display !==
          'none' &&
        document.querySelector('#pdf-canvas').dataset.scale === expectedScale &&
        document.querySelector('#pdf-viewer').dataset.state === 'ready',
      defaultFit.scale,
    );
    cases.push('side-navigation', 'zoom-bounds', 'fit-width-resize');

    await page.locator('#last-page').click();
    await page.waitForSelector('#pdf-canvas[data-page-number="5"]');
    assert.equal(await page.locator('#pdf-page-count').innerText(), '5 / 5');
    assert.equal(await page.locator('#next-page').isDisabled(), true);
    assert.equal(await page.locator('#last-page').isDisabled(), true);

    await page.locator('#previous-page').click();
    await page.waitForSelector('#pdf-canvas[data-page-number="4"]');
    const pageFourPixels = await page
      .locator('#pdf-canvas')
      .evaluate((canvas) =>
        Array.from(canvas.getContext('2d').getImageData(50, 50, 1, 1).data),
      );
    for (const invalidPage of ['0', '6', '1.5', '']) {
      await page.locator('#page-number').fill(invalidPage);
      await page.locator('#page-number').press('Enter');
      await page.waitForFunction(() =>
        document
          .querySelector('#viewer-status')
          .textContent.includes('사이의 정수'),
      );
      assert.equal(
        await page.locator('#pdf-canvas').getAttribute('data-page-number'),
        '4',
      );
      assert.equal(await page.locator('#page-number').inputValue(), '4');
      assert.deepEqual(
        await page
          .locator('#pdf-canvas')
          .evaluate((canvas) =>
            Array.from(canvas.getContext('2d').getImageData(50, 50, 1, 1).data),
          ),
        pageFourPixels,
      );
    }

    await page.locator('#first-page').click();
    await page.waitForSelector('#pdf-canvas[data-page-number="1"]');
    await page.evaluate(() => {
      document.querySelector('#next-page').click();
      document.querySelector('#next-page').click();
      document.querySelector('#next-page').click();
    });
    await page.waitForSelector('#pdf-canvas[data-page-number="4"]');
    assert.equal(await page.locator('#pdf-page-count').innerText(), '4 / 5');
    assert.equal(await page.locator('#viewer-status').isHidden(), true);
    assert.equal(
      await page.locator('#document-state').innerText(),
      '원문 보기 · 4 / 5',
    );
    assert.equal(await hash(files.multipage), multipageHash);
    cases.push('first-last', 'invalid-page', 'rapid-page-navigation');
    await page.screenshot({
      path: path.join(artifacts, 'page-navigation.png'),
      fullPage: true,
    });

    await select({ canceled: false, filePaths: [files.rotated] }, 'selected');
    assert.equal(
      await page.locator('#pdf-canvas').getAttribute('data-rotation'),
      '90',
    );
    const rotatedSize = await page
      .locator('#pdf-canvas')
      .evaluate((canvas) => ({
        width: canvas.getBoundingClientRect().width,
        height: canvas.getBoundingClientRect().height,
      }));
    assert.ok(rotatedSize.height > rotatedSize.width);
    cases.push('intrinsic-rotation');

    await select({ canceled: false, filePaths: [files.valid] }, 'selected');
    assert.equal(await page.locator('#pdf-page-count').innerText(), '1 / 1');
    assert.equal(await page.locator('#page-number').inputValue(), '1');
    assert.equal(await page.locator('#first-page').isDisabled(), true);
    assert.equal(await page.locator('#previous-page').isDisabled(), true);
    assert.equal(await page.locator('#next-page').isDisabled(), true);
    assert.equal(await page.locator('#last-page').isDisabled(), true);
    cases.push('file-replacement-page-reset');

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

    await select({ canceled: false, filePaths: [files.password] }, 'error');
    assert.match(
      await page.locator('#viewer-status').innerText(),
      /암호가 필요한 PDF/,
    );
    assert.equal(await page.locator('#pdf-canvas').isHidden(), true);
    cases.push('password-required');

    await select({ canceled: false, filePaths: [files.headerOnly] }, 'error');
    assert.match(
      await page.locator('#viewer-status').innerText(),
      /PDF 구조가 손상됐거나 지원할 수 없는 형식/,
    );
    assert.equal(await page.locator('#pdf-canvas').isHidden(), true);
    cases.push('damaged-structure');

    await dispatchDrop({ filePaths: [files.replacement] });
    await page.waitForFunction(
      () =>
        document.querySelector('#selected-file-name').textContent ===
          '다른 문서.pdf' &&
        document.querySelector('#selection-status').dataset.state ===
          'selected',
    );
    assert.equal(await page.locator('#selection-status').isHidden(), true);
    assert.equal(
      await page.locator('#footer-status').innerText(),
      'PDF를 열었습니다. 원본 파일은 변경하지 않았습니다.',
    );
    assert.equal(await hash(files.replacement), replacementHash);
    await page.screenshot({
      path: path.join(artifacts, 'dropped-pdf.png'),
      fullPage: true,
    });

    for (const [name, input, message] of [
      [
        'multiple',
        { filePaths: [files.valid, files.replacement] },
        'PDF 파일은 한 개씩',
      ],
      ['folder', { filePaths: [files.folder] }, '폴더 대신 PDF 파일 한 개'],
      [
        'url',
        {
          items: [
            {
              mimeType: 'text/uri-list',
              data: 'https://example.invalid/document.pdf',
              title: '',
              baseURL: '',
            },
          ],
        },
        '웹 주소는 열 수 없습니다',
      ],
    ]) {
      await dispatchDrop(input);
      await page.waitForFunction(
        (expected) =>
          document
            .querySelector('#selection-status')
            .textContent.includes(expected),
        message,
      );
      assert.equal(
        await page.locator('#selected-file-name').innerText(),
        '다른 문서.pdf',
      );
      cases.push(`drop-${name}`);
    }

    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File(['%PDF-1.7\n'], 'memory-only.pdf', {
          type: 'application/pdf',
        }),
      );
      document.querySelector('.workspace').dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
    });
    await page.waitForFunction(() =>
      document
        .querySelector('#selection-status')
        .textContent.includes('로컬 파일 경로를 확인할 수 없습니다'),
    );
    assert.equal(
      await page.locator('#selected-file-name').innerText(),
      '다른 문서.pdf',
    );
    cases.push('drop-empty-path');

    await page.evaluate(() => {
      const transfer = new DataTransfer();
      document.querySelector('.workspace').dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
    });
    await page.waitForFunction(() =>
      document
        .querySelector('#selection-status')
        .textContent.includes('드롭한 항목에서 파일을 찾지 못했습니다'),
    );
    assert.equal(
      await page.locator('#selected-file-name').innerText(),
      '다른 문서.pdf',
    );
    cases.push('drop-empty');
    assert.equal(await hash(), originalHash);
    assert.equal(await hash(files.replacement), replacementHash);
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
          '다른 문서.pdf',
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
          '다른 문서.pdf' &&
        document.querySelector('#selection-status').dataset.state ===
          'selected',
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
      droppedHashUnchanged: true,
      droppedFile: 'selected through Chromium drag event and shared inspector',
      rejectedDrops: [
        'multiple',
        'folder',
        'URL',
        'empty path',
        'empty transfer',
      ],
      nativeAccessDenied,
      foreignWindowBlocked: true,
      canceledAndFailedSelectionPreserved: true,
      concurrentRequest: 'busy',
      rendered: 'Korean text and embedded raster image on Canvas',
      parserFailures: ['password required', 'damaged structure'],
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
