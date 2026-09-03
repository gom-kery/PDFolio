import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createPdfFixtures } from './pdf-fixtures.js';

/** Use controlled native-dialog results, but real IPC, filesystem checks and renderer UI. */
export async function checkPdfSelection(application, page, artifacts) {
  const performanceSanityLimitMs = 10_000;
  const performance = {};
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
  const keywordHash = await hash(files.keyword);
  const regionHash = await hash(files.region);
  const regionReverseHash = await hash(files.regionReverse);
  const startCanvasFrameProbe = async () =>
    page.evaluate(() => {
      const canvas = document.querySelector('#pdf-canvas');
      const widthDescriptor = Object.getOwnPropertyDescriptor(
        HTMLCanvasElement.prototype,
        'width',
      );
      const heightDescriptor = Object.getOwnPropertyDescriptor(
        HTMLCanvasElement.prototype,
        'height',
      );
      const probe = {
        active: true,
        writes: 0,
        staleFrames: [],
        initialPageNumber: canvas.dataset.pageNumber,
        initialScale: canvas.dataset.scale,
      };
      globalThis.canvasFrameProbe = probe;
      const observeBackingStoreWrite = () => {
        probe.writes++;
        requestAnimationFrame(() => {
          if (
            probe.active &&
            canvas.dataset.pageNumber === probe.initialPageNumber &&
            canvas.dataset.scale === probe.initialScale
          ) {
            probe.staleFrames.push({
              pageNumber: canvas.dataset.pageNumber,
              scale: canvas.dataset.scale,
              width: canvas.width,
              height: canvas.height,
            });
          }
        });
      };
      Object.defineProperties(canvas, {
        width: {
          configurable: true,
          get: () => widthDescriptor.get.call(canvas),
          set: (value) => {
            widthDescriptor.set.call(canvas, value);
            observeBackingStoreWrite();
          },
        },
        height: {
          configurable: true,
          get: () => heightDescriptor.get.call(canvas),
          set: (value) => {
            heightDescriptor.set.call(canvas, value);
            observeBackingStoreWrite();
          },
        },
      });
    });
  const stopCanvasFrameProbe = async () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const probe = globalThis.canvasFrameProbe;
              probe.active = false;
              const result = {
                writes: probe.writes,
                staleFrames: probe.staleFrames,
              };
              delete document.querySelector('#pdf-canvas').width;
              delete document.querySelector('#pdf-canvas').height;
              resolve(result);
            }),
          );
        }),
    );
  const assertCanvasStayedPainted = (probe, label) => {
    assert.ok(probe.writes > 0, `${label}: visible Canvas was not updated`);
    assert.deepEqual(
      probe.staleFrames,
      [],
      `${label}: visible Canvas was cleared before the next render completed`,
    );
  };
  const assertCanvasBecameIdle = async (label) => {
    await startCanvasFrameProbe();
    await page.waitForTimeout(450);
    const probe = await stopCanvasFrameProbe();
    assert.equal(probe.writes, 0, `${label}: fit-height render did not settle`);
    assert.deepEqual(probe.staleFrames, []);
  };
  const startViewerGeometryProbe = async () =>
    page.evaluate(() => {
      const stage = document.querySelector('.pdf-page-stage');
      const status = document.querySelector('#viewer-status');
      const initial = stage.getBoundingClientRect();
      const probe = {
        active: true,
        initialTop: initial.top,
        initialHeight: initial.height,
        maximumTopDelta: 0,
        maximumHeightDelta: 0,
        statusShown: 0,
      };
      const sample = () => {
        const bounds = stage.getBoundingClientRect();
        probe.maximumTopDelta = Math.max(
          probe.maximumTopDelta,
          Math.abs(bounds.top - probe.initialTop),
        );
        probe.maximumHeightDelta = Math.max(
          probe.maximumHeightDelta,
          Math.abs(bounds.height - probe.initialHeight),
        );
        if (probe.active) requestAnimationFrame(sample);
      };
      const observer = new MutationObserver((records) => {
        probe.statusShown += records.filter(
          (record) => record.oldValue !== null,
        ).length;
        sample();
      });
      observer.observe(status, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['hidden'],
      });
      probe.observer = observer;
      globalThis.viewerGeometryProbe = probe;
      sample();
    });
  const stopViewerGeometryProbe = async () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const probe = globalThis.viewerGeometryProbe;
              probe.active = false;
              probe.observer.disconnect();
              resolve({
                maximumTopDelta: probe.maximumTopDelta,
                maximumHeightDelta: probe.maximumHeightDelta,
                statusShown: probe.statusShown,
              });
            }),
          );
        }),
    );
  const assertViewerGeometryStayedStable = (probe, label) => {
    assert.ok(probe.statusShown > 0, `${label}: loading status was not shown`);
    assert.ok(
      probe.maximumTopDelta <= 1,
      `${label}: page stage moved vertically by ${probe.maximumTopDelta}px`,
    );
    assert.ok(
      probe.maximumHeightDelta <= 1,
      `${label}: page stage height changed by ${probe.maximumHeightDelta}px`,
    );
  };
  const dispatchDrop = async ({ filePaths = [], items = [] }) => {
    const box = await page.locator('.workspace').boundingBox();
    assert.ok(box);
    const viewport = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
    }));
    const visibleBox = {
      left: Math.max(0, box.x),
      top: Math.max(0, box.y),
      right: Math.min(viewport.width, box.x + box.width),
      bottom: Math.min(viewport.height, box.y + box.height),
    };
    assert.ok(visibleBox.right > visibleBox.left);
    assert.ok(visibleBox.bottom > visibleBox.top);
    const session = await page.context().newCDPSession(page);
    const data = {
      items,
      files: filePaths,
      dragOperationsMask: 1,
    };
    const point = {
      x: (visibleBox.left + visibleBox.right) / 2,
      y: (visibleBox.top + visibleBox.bottom) / 2,
    };
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
      await page.locator('#selected-file-name').textContent(),
      '선택한 파일 없음',
    );
    const firstRenderStartedAt = Date.now();
    await select({ canceled: false, filePaths: [files.valid] }, 'selected');
    performance.firstPageMs = Date.now() - firstRenderStartedAt;
    assert.ok(performance.firstPageMs < performanceSanityLimitMs);
    await page.waitForSelector(
      '#text-analysis-status[data-state="text-usable"]',
      { timeout: 10_000 },
    );
    await page.waitForSelector('#keyword-analysis-status[data-state="none"]', {
      timeout: 10_000,
    });
    await page.waitForSelector('#region-analysis-status[data-state="none"]', {
      timeout: 10_000,
    });
    await page.waitForSelector(
      '#support-profile-status[data-state="not-supported"]',
      { timeout: 10_000 },
    );
    assert.equal(
      await page.locator('#selected-file-name').textContent(),
      '한글 문서 & 연습.PDF',
    );
    const documentInformation = page.locator('#document-information');
    const documentInformationSummary = documentInformation.locator('summary');
    assert.equal(
      await documentInformation.evaluate((details) => details.open),
      false,
    );
    assert.equal(await page.locator('#text-analysis-status').isVisible(), true);
    await documentInformationSummary.focus();
    await page.keyboard.press('Enter');
    assert.equal(
      await documentInformation.evaluate((details) => details.open),
      true,
    );
    assert.equal(await page.locator('#selected-file-name').isVisible(), true);
    assert.equal(
      await documentInformationSummary.evaluate(
        (summary) => document.activeElement === summary,
      ),
      true,
    );
    await page.keyboard.press('Enter');
    assert.equal(
      await documentInformation.evaluate((details) => details.open),
      false,
    );
    assert.equal(
      await page.locator('#support-profile-status').isVisible(),
      true,
    );
    assert.match(
      await page.locator('#selected-file-size').textContent(),
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
        textAnalysis: document.querySelector('#text-analysis-status')
          .textContent,
        textAnalysisState: document.querySelector('#text-analysis-status')
          .dataset.state,
        keywordAnalysis: document.querySelector('#keyword-analysis-status')
          .textContent,
        keywordAnalysisState: document.querySelector('#keyword-analysis-status')
          .dataset.state,
        regionAnalysis: document.querySelector('#region-analysis-status')
          .textContent,
        regionAnalysisState: document.querySelector('#region-analysis-status')
          .dataset.state,
        supportProfile: document.querySelector('#support-profile-status')
          .textContent,
        supportProfileState: document.querySelector('#support-profile-status')
          .dataset.state,
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
    assert.equal(renderedPage.textAnalysisState, 'text-usable');
    assert.equal(
      renderedPage.textAnalysis,
      '현재 페이지의 텍스트와 위치를 분석할 수 있습니다.',
    );
    assert.equal(renderedPage.keywordAnalysisState, 'none');
    assert.equal(
      renderedPage.keywordAnalysis,
      '현재 페이지에서 제목 키워드 후보를 찾지 못했습니다.',
    );
    assert.equal(renderedPage.regionAnalysisState, 'none');
    assert.equal(
      renderedPage.regionAnalysis,
      '제목 키워드 후보가 없어 영역을 계산하지 않았습니다.',
    );
    assert.equal(renderedPage.supportProfileState, 'not-supported');
    assert.equal(
      renderedPage.supportProfile,
      '현재 페이지는 첫 MVP 분석 프로파일을 지원하지 않습니다.',
    );
    assert.ok(
      !(await page.locator('body').innerText()).includes(
        'PDF.js가 한글과 포함된 이미지를 오프라인으로 표시합니다.',
      ),
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

    await select({ canceled: false, filePaths: [files.keyword] }, 'selected');
    await page.waitForSelector('#keyword-analysis-status[data-state="found"]', {
      timeout: 10_000,
    });
    await page.waitForSelector('#region-analysis-status[data-state="found"]', {
      timeout: 10_000,
    });
    await page.waitForSelector(
      '#support-profile-status[data-state="not-supported"]',
      { timeout: 10_000 },
    );
    assert.equal(
      await page.locator('#keyword-analysis-status').innerText(),
      '현재 페이지에서 제목 키워드 후보 1개를 찾았습니다.',
    );
    assert.equal(
      await page.locator('#region-analysis-status').innerText(),
      '현재 페이지에서 영역 후보 1개를 계산했습니다. 안전한 가림은 아직 확인하지 않았습니다.',
    );
    const keywordPageText = await page.locator('body').innerText();
    assert.ok(!keywordPageText.includes('Explanation: worked result.'));
    assert.ok(!keywordPageText.includes('Answer choices are A through D.'));
    assert.equal(await hash(files.keyword), keywordHash);
    cases.push(
      'keyword-candidate',
      'keyword-false-positive-suppression',
      'keyword-text-not-in-dom',
    );

    await select({ canceled: false, filePaths: [files.region] }, 'selected');
    await page.waitForSelector('#keyword-analysis-status[data-state="found"]', {
      timeout: 10_000,
    });
    await page.waitForSelector('#region-analysis-status[data-state="found"]', {
      timeout: 10_000,
    });
    await page.waitForSelector(
      '#support-profile-status[data-state="profile-match"]',
      { timeout: 10_000 },
    );
    assert.equal(
      await page.locator('#keyword-analysis-status').innerText(),
      '현재 페이지에서 제목 키워드 후보 2개를 찾았습니다.',
    );
    assert.equal(
      await page.locator('#region-analysis-status').innerText(),
      '현재 페이지에서 영역 후보 2개를 계산했습니다. 안전한 가림은 아직 확인하지 않았습니다.',
    );
    const regionReasonCodes = (
      await page
        .locator('#region-analysis-status')
        .getAttribute('data-reason-codes')
    ).split(/\s+/);
    assert.ok(regionReasonCodes.includes('NON_TEXT_CONTENT_UNVERIFIED'));
    assert.ok(regionReasonCodes.includes('OPEN_ENDED_LAST_REGION'));
    assert.match(
      await page.locator('#support-profile-status').innerText(),
      /CBT 시작은 아직 승인되지 않았습니다/,
    );
    const profileReasonCodes = (
      await page
        .locator('#support-profile-status')
        .getAttribute('data-reason-codes')
    ).split(/\s+/);
    assert.ok(profileReasonCodes.includes('SAFE_MASK_NOT_VERIFIED'));
    assert.ok(
      profileReasonCodes.includes('QUESTION_OWNERSHIP_NOT_ESTABLISHED'),
    );
    const regionPageText = await page.locator('body').innerText();
    assert.ok(
      !regionPageText.includes('Continue the reasoning to the result.'),
    );
    assert.equal(await hash(files.region), regionHash);
    cases.push(
      'answer-region-solution-then-answer',
      'answer-region-text-not-in-dom',
      'answer-region-file-unchanged',
      'support-profile-solution-then-answer',
      'support-profile-does-not-approve-cbt',
    );

    await select(
      { canceled: false, filePaths: [files.regionReverse] },
      'selected',
    );
    await page.waitForSelector(
      '#support-profile-status[data-state="profile-match"]',
      { timeout: 10_000 },
    );
    assert.equal(
      await page.locator('#region-analysis-status').innerText(),
      '현재 페이지에서 영역 후보 2개를 계산했습니다. 안전한 가림은 아직 확인하지 않았습니다.',
    );
    assert.equal(await hash(files.regionReverse), regionReverseHash);
    assert.ok(
      !(await page.locator('body').innerText()).includes(
        'Continue the explanation to its conclusion.',
      ),
    );
    cases.push(
      'support-profile-answer-then-solution',
      'support-profile-reverse-file-unchanged',
    );

    await select({ canceled: false, filePaths: [files.multipage] }, 'selected');
    await page.waitForSelector(
      '#text-analysis-status[data-state="text-insufficient"]',
      { timeout: 10_000 },
    );
    await page.waitForSelector('#support-profile-status[data-state="hold"]', {
      timeout: 10_000,
    });
    assert.equal(await page.locator('#pdf-page-count').textContent(), '1 / 5');
    assert.equal(
      await page
        .locator('#text-analysis-status')
        .getAttribute('data-reason-codes'),
      'NO_TEXT_ITEMS',
    );
    assert.equal(
      await page.locator('#keyword-analysis-status').getAttribute('data-state'),
      'skipped',
    );
    assert.equal(
      await page.locator('#region-analysis-status').getAttribute('data-state'),
      'skipped',
    );
    assert.equal(
      await page
        .locator('#support-profile-status')
        .getAttribute('data-reason-codes'),
      'TEXT_NOT_USABLE NO_TEXT_ITEMS',
    );
    assert.equal(await page.locator('#page-number').inputValue(), '1');
    assert.equal(await page.locator('#first-page').isDisabled(), true);
    assert.equal(await page.locator('#previous-page').isDisabled(), true);

    const layout = await page.evaluate(() => {
      const workspace = document.querySelector('.workspace');
      const stage = document.querySelector('.pdf-page-stage');
      const navigation = document.querySelector('#pdf-page-navigation');
      const statusPanel = document.querySelector('.status-panel');
      const sideNext = document.querySelector('#side-next-page');
      return {
        workspaceRight: workspace.getBoundingClientRect().right,
        stageBottom: stage.getBoundingClientRect().bottom,
        navigationLeft: navigation.getBoundingClientRect().left,
        navigationTop: navigation.getBoundingClientRect().top,
        statusBottom: statusPanel.getBoundingClientRect().bottom,
        sideNextDisplay: getComputedStyle(sideNext).display,
      };
    });
    assert.ok(layout.navigationLeft >= layout.workspaceRight);
    assert.ok(layout.navigationTop >= layout.statusBottom);
    assert.ok(layout.navigationTop < layout.stageBottom);
    assert.notEqual(layout.sideNextDisplay, 'none');
    assert.equal(await page.locator('#side-previous-page').isDisabled(), true);
    assert.equal(await page.locator('#side-next-page').isDisabled(), false);
    await startCanvasFrameProbe();
    await startViewerGeometryProbe();
    await page.locator('#side-next-page').click();
    await page.waitForSelector('#pdf-canvas[data-page-number="2"]');
    assertCanvasStayedPainted(await stopCanvasFrameProbe(), 'page navigation');
    assertViewerGeometryStayedStable(
      await stopViewerGeometryProbe(),
      'page navigation',
    );
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
    const fitHeightStartedAt = Date.now();
    await page.locator('#fit-height').click();
    await page.waitForFunction(() => {
      const fit = document.querySelector('#fit-height');
      const canvas = document.querySelector('#pdf-canvas');
      const scroll = document.querySelector('.pdf-page-scroll');
      const styles = getComputedStyle(scroll);
      const available =
        scroll.clientHeight -
        Number.parseFloat(styles.paddingTop) -
        Number.parseFloat(styles.paddingBottom);
      const height = canvas.getBoundingClientRect().height;
      return (
        fit.getAttribute('aria-pressed') === 'true' &&
        canvas.dataset.scale !== '0.5' &&
        height <= available + 1
      );
    });
    performance.fitHeightMs = Date.now() - fitHeightStartedAt;
    assert.ok(performance.fitHeightMs < performanceSanityLimitMs);
    const defaultFit = await page.evaluate(() => {
      const scroll = document.querySelector('.pdf-page-scroll');
      const canvas = document.querySelector('#pdf-canvas');
      const styles = getComputedStyle(scroll);
      const available =
        scroll.clientHeight -
        Number.parseFloat(styles.paddingTop) -
        Number.parseFloat(styles.paddingBottom);
      return {
        available,
        height: canvas.getBoundingClientRect().height,
        fillRatio: canvas.getBoundingClientRect().height / available,
        scale: canvas.dataset.scale,
      };
    });
    assert.ok(
      defaultFit.height <= defaultFit.available + 1,
      JSON.stringify(defaultFit),
    );
    assert.ok(defaultFit.fillRatio >= 0.85, JSON.stringify(defaultFit));
    await assertCanvasBecameIdle('fit-height activation');
    await startCanvasFrameProbe();
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
    assertCanvasStayedPainted(
      await stopCanvasFrameProbe(),
      'fit-height window resize',
    );
    await assertCanvasBecameIdle('fit-height window resize');
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const narrowLayout = await page.evaluate(() => {
      const navigation = document.querySelector('#pdf-page-navigation');
      const statusPanel = document.querySelector('.status-panel');
      const navigationBounds = navigation.getBoundingClientRect();
      return {
        navigationTop: navigationBounds.top,
        navigationLeft: navigationBounds.left,
        navigationRight: navigationBounds.right,
        statusTop: statusPanel.getBoundingClientRect().top,
      };
    });
    assert.ok(narrowLayout.navigationTop < narrowLayout.statusTop);
    assert.ok(narrowLayout.navigationLeft >= 0);
    assert.ok(narrowLayout.navigationRight <= 640);
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
    cases.push(
      'right-side-controls',
      'narrow-controls-before-status',
      'side-navigation',
      'zoom-bounds',
      'fit-height-resize',
      'canvas-double-buffer',
      'viewer-geometry-stability',
      'fit-height-quiescence',
      'page-text-usable',
      'page-text-insufficient',
      'page-text-not-in-dom',
    );

    const lastPageStartedAt = Date.now();
    await page.locator('#last-page').click();
    await page.waitForSelector('#pdf-canvas[data-page-number="5"]');
    performance.lastPageMs = Date.now() - lastPageStartedAt;
    assert.ok(performance.lastPageMs < performanceSanityLimitMs);
    assert.equal(await page.locator('#pdf-page-count').textContent(), '5 / 5');
    assert.equal(await page.locator('#next-page').isDisabled(), true);
    assert.equal(await page.locator('#last-page').isDisabled(), true);

    await page.locator('#previous-page').click();
    await page.waitForSelector('#pdf-canvas[data-page-number="4"]');
    const pageFourImage = await page
      .locator('#pdf-canvas')
      .evaluate((canvas) => canvas.toDataURL('image/png'));
    for (const invalidPage of ['0', '6', '1.5', '']) {
      await page.locator('#viewer-status').evaluate((element) => {
        element.dataset.state = 'test-pending';
        element.textContent = '';
      });
      await page.locator('#page-number').fill(invalidPage);
      await page.locator('#page-number').press('Enter');
      await page.waitForFunction(() => {
        const status = document.querySelector('#viewer-status');
        return (
          status.dataset.state === 'error' &&
          status.textContent.includes('사이의 정수')
        );
      });
      assert.equal(
        await page.locator('#pdf-canvas').getAttribute('data-page-number'),
        '4',
      );
      assert.equal(await page.locator('#page-number').inputValue(), '4');
      assert.deepEqual(
        await page
          .locator('#pdf-canvas')
          .evaluate((canvas) => canvas.toDataURL('image/png')),
        pageFourImage,
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
    await page.waitForFunction(() => {
      const viewer = document.querySelector('#pdf-viewer');
      const status = document.querySelector('#viewer-status');
      return viewer.dataset.state === 'ready' && status.hidden;
    });
    assert.equal(await page.locator('#pdf-page-count').textContent(), '4 / 5');
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
    assert.equal(await page.locator('#pdf-page-count').textContent(), '1 / 1');
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
        await page.locator('#selected-file-name').textContent(),
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
        await page.locator('#selected-file-name').textContent(),
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
      await page.locator('#selected-file-name').textContent(),
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
      await page.locator('#selected-file-name').textContent(),
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
          await page.locator('#selected-file-name').textContent(),
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
    await page.waitForSelector('#runtime-status[data-state="connected"]', {
      state: 'attached',
    });
    assert.equal(
      await page.locator('#selected-file-name').textContent(),
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
      performance: {
        sanityLimitMs: performanceSanityLimitMs,
        ...performance,
      },
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
