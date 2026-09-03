import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { _electron } from 'playwright-core';
import { APP_URL } from '../electron/config.js';
import { createPdfFixtures } from './helpers/pdf-fixtures.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(import.meta.url);

test(
  'explicit debug mode aligns text, keyword and region evidence with the Canvas',
  { timeout: 60000 },
  async () => {
    const evidenceRoot = path.join(root, 'work/debug-overlay-tests');
    await mkdir(evidenceRoot, { recursive: true });
    const artifacts = await mkdtemp(path.join(evidenceRoot, 'case-'));
    const files = await createPdfFixtures(path.join(artifacts, 'inputs'));
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const errors = [];
    let application;
    try {
      application = await _electron.launch({
        executablePath: require('electron'),
        args: [
          root,
          '--debug-overlay',
          `--user-data-dir=${path.join(artifacts, 'profile')}`,
        ],
        cwd: artifacts,
        env,
        chromiumSandbox: true,
      });
      const page = await application.firstWindow();
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.waitForSelector('#runtime-status[data-state="connected"]', {
        state: 'attached',
      });
      const debugUrl = new URL(APP_URL);
      debugUrl.searchParams.set('debugOverlay', '1');
      assert.equal(page.url(), debugUrl.toString());
      assert.equal(
        await page.locator('html').getAttribute('data-debug-overlay'),
        'enabled',
      );
      assert.equal(await page.locator('#pdf-debug-panel').count(), 1);
      assert.equal(await page.locator('#pdf-debug-panel').isHidden(), true);
      assert.equal(await page.locator('#pdf-debug-overlay').isHidden(), true);
      assert.equal(await page.locator('#manual-region-setup').isHidden(), true);
      assert.equal(
        await page.locator('#manual-region-overlay').isHidden(),
        true,
      );

      await application.evaluate(({ dialog }, file) => {
        globalThis.unit25DebugFile = file;
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [globalThis.unit25DebugFile],
        });
      }, files.region);
      await page.locator('#select-pdf').click();
      await page.waitForSelector('#region-analysis-status[data-state="found"]');
      await page.waitForSelector('#pdf-debug-overlay[data-state="ready"]');
      assert.equal(await page.locator('#pdf-debug-panel').isVisible(), true);

      const initial = await page.evaluate(() => {
        const canvas = document.querySelector('#pdf-canvas');
        const overlay = document.querySelector('#pdf-debug-overlay');
        const firstText = overlay.querySelector('[data-layer="text-item"]');
        const bounds = (element) => {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        };
        return {
          canvas: bounds(canvas),
          overlay: bounds(overlay),
          firstText: bounds(firstText),
          textItems: overlay.querySelectorAll('[data-layer="text-item"]')
            .length,
          keywords: overlay.querySelectorAll('[data-layer="keyword"]').length,
          regionBounds: overlay.querySelectorAll('[data-layer="region-bound"]')
            .length,
          regionText: overlay.querySelectorAll('[data-layer="region-text"]')
            .length,
          scale: overlay.dataset.scale,
          rotation: overlay.dataset.rotation,
          debugText: document.querySelector('#pdf-debug-panel').innerText,
          bodyText: document.body.innerText,
        };
      });
      assert.equal(initial.scale, '1');
      assert.equal(initial.rotation, '0');
      assert.ok(initial.textItems >= 5);
      assert.equal(initial.keywords, 2);
      assert.equal(initial.regionBounds, 2);
      assert.ok(initial.regionText >= 3);
      assert.ok(Math.abs(initial.overlay.width - initial.canvas.width) <= 1);
      assert.ok(Math.abs(initial.overlay.height - initial.canvas.height) <= 1);
      assert.match(
        initial.debugText,
        /Text Item \d+개 · 키워드 2개 · 영역 2개/,
      );
      assert.ok(
        !initial.bodyText.includes('Continue the reasoning to the result.'),
      );
      assert.ok(!initial.bodyText.includes('Answer: B'));
      await page.screenshot({
        path: path.join(artifacts, 'debug-overlay-regions.png'),
        fullPage: true,
      });

      await page.locator('#zoom-in').click();
      await page.waitForSelector('#pdf-debug-overlay[data-scale="1.25"]');
      const zoomed = await page
        .locator('#pdf-debug-overlay [data-layer="text-item"]')
        .first()
        .evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        });
      assert.ok(zoomed.width > initial.firstText.width * 1.24);
      assert.ok(zoomed.height > initial.firstText.height * 1.24);

      await page.locator('#fit-height').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#pdf-debug-overlay')?.dataset.scale !==
          '1.25',
      );
      const fitScale = await page
        .locator('#pdf-debug-overlay')
        .getAttribute('data-scale');
      await application.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].setSize(980, 650);
      });
      await page.waitForFunction(
        (previousScale) =>
          document.querySelector('#pdf-debug-overlay')?.dataset.scale !==
          previousScale,
        fitScale,
      );
      const resized = await page.evaluate(() => {
        const canvas = document
          .querySelector('#pdf-canvas')
          .getBoundingClientRect();
        const overlay = document
          .querySelector('#pdf-debug-overlay')
          .getBoundingClientRect();
        return {
          canvas: { width: canvas.width, height: canvas.height },
          overlay: { width: overlay.width, height: overlay.height },
        };
      });
      assert.ok(Math.abs(resized.overlay.width - resized.canvas.width) <= 1);
      assert.ok(Math.abs(resized.overlay.height - resized.canvas.height) <= 1);

      await page.locator('.pdf-debug-toggle').click();
      assert.equal(await page.locator('#pdf-debug-overlay').isHidden(), true);
      await page.locator('.pdf-debug-toggle').click();
      assert.equal(await page.locator('#pdf-debug-overlay').isVisible(), true);

      await application.evaluate((_electron, file) => {
        globalThis.unit25DebugFile = file;
      }, files.coordinates);
      await page.locator('#select-pdf').click();
      await page.waitForSelector('#pdf-debug-overlay[data-state="ready"]');
      await page.locator('#next-page').click();
      await page.waitForSelector(
        '#pdf-debug-overlay[data-page-number="2"][data-rotation="90"]',
      );
      const rotated = await page.evaluate(() => {
        const canvas = document
          .querySelector('#pdf-canvas')
          .getBoundingClientRect();
        const overlay = document
          .querySelector('#pdf-debug-overlay')
          .getBoundingClientRect();
        return {
          canvas: { width: canvas.width, height: canvas.height },
          overlay: { width: overlay.width, height: overlay.height },
          textItems: document.querySelectorAll(
            '#pdf-debug-overlay [data-layer="text-item"]',
          ).length,
          bodyText: document.body.innerText,
        };
      });
      assert.ok(rotated.textItems > 0);
      assert.ok(Math.abs(rotated.overlay.width - rotated.canvas.width) <= 1);
      assert.ok(Math.abs(rotated.overlay.height - rotated.canvas.height) <= 1);
      assert.ok(!rotated.bodyText.includes('Coordinate sample'));
      await page.screenshot({
        path: path.join(artifacts, 'debug-overlay-rotation-90.png'),
        fullPage: true,
      });
      for (const [pageNumber, rotation] of [
        [3, 180],
        [4, 270],
      ]) {
        await page.locator('#next-page').click();
        await page.waitForSelector(
          `#pdf-debug-overlay[data-page-number="${pageNumber}"][data-rotation="${rotation}"]`,
        );
        const geometry = await page.evaluate(() => {
          const canvas = document
            .querySelector('#pdf-canvas')
            .getBoundingClientRect();
          const overlay = document
            .querySelector('#pdf-debug-overlay')
            .getBoundingClientRect();
          return {
            canvas: { width: canvas.width, height: canvas.height },
            overlay: { width: overlay.width, height: overlay.height },
            textItems: document.querySelectorAll(
              '#pdf-debug-overlay [data-layer="text-item"]',
            ).length,
          };
        });
        assert.ok(geometry.textItems > 0);
        assert.ok(
          Math.abs(geometry.overlay.width - geometry.canvas.width) <= 1,
        );
        assert.ok(
          Math.abs(geometry.overlay.height - geometry.canvas.height) <= 1,
        );
      }
      assert.deepEqual(errors, []);
      console.log(`Debug overlay evidence: ${path.relative(root, artifacts)}`);
    } finally {
      await application?.close();
    }
  },
);
