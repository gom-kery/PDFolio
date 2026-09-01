import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  getDocument,
  InvalidPDFException,
  PasswordException,
  RenderingCancelledException,
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import { assessPageText } from '../src/analysis/page-text-assessment.js';
import { createPdfAdapterCore } from '../src/pdf/pdf-adapter-core.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixture = path.join(root, 'tests/fixtures/unit-1.3-korean-image.pdf');
const assetUrl = (directory) =>
  pathToFileURL(
    path.join(root, 'node_modules/pdfjs-dist', directory) + path.sep,
  ).href;

function wrapPdfJsForTextExtraction(evidence) {
  return {
    InvalidPDFException,
    PasswordException,
    RenderingCancelledException,
    getDocument(options) {
      evidence.requestedOptions = options;
      const loadingTask = getDocument({
        ...options,
        cMapUrl: assetUrl('cmaps'),
        iccUrl: assetUrl('iccs'),
        standardFontDataUrl: assetUrl('standard_fonts'),
        wasmUrl: assetUrl('wasm'),
      });
      return {
        promise: loadingTask.promise.then((document) => ({
          numPages: document.numPages,
          async getPage(pageNumber) {
            const page = await document.getPage(pageNumber);
            return {
              view: page.view,
              userUnit: page.userUnit,
              rotate: page.rotate,
              getViewport: (parameters) => page.getViewport(parameters),
              getTextContent: (parameters) => page.getTextContent(parameters),
              render: () => ({
                promise: Promise.resolve(),
                cancel: () => assert.fail('Completed synthetic render'),
              }),
              cleanup: () => page.cleanup(),
            };
          },
        })),
        destroy: () => loadingTask.destroy(),
      };
    },
  };
}

test('installed PDF.js extracts and assesses the Korean-image fixture without changing it', async () => {
  const original = await readFile(fixture);
  const originalHash = createHash('sha256').update(original).digest('hex');
  const evidence = {};
  const adapter = createPdfAdapterCore({
    pdfjsApi: wrapPdfJsForTextExtraction(evidence),
    assetBaseUrl: 'local-cbt://app/index.html',
  });
  const opened = await adapter.open({
    data: new Uint8Array(original),
    canvas: { style: {} },
  });
  assert.equal(opened.status, 'rendered');

  const extraction = await adapter.extractPageText({ pageNumber: 1 });
  assert.equal(extraction.status, 'extracted');
  assert.equal(extraction.source.items.length, 6);
  assert.equal(extraction.source.styles.length, 1);
  assert.equal(extraction.source.language, null);
  assert.deepEqual(extraction.source.page.viewBox, [0, 0, 420, 595]);
  assert.ok(!Object.hasOwn(extraction.source, 'path'));
  assert.ok(!Object.hasOwn(extraction.source, 'document'));
  assert.ok(!Object.hasOwn(extraction.source, 'textContent'));

  const assessment = assessPageText(extraction);
  assert.equal(assessment.quality, 'text-usable');
  assert.deepEqual(assessment.reasonCodes, []);
  assert.equal(assessment.metrics.itemCount, 6);
  assert.equal(assessment.metrics.nonWhitespaceCharacterCount, 73);
  assert.equal(assessment.metrics.readableCharacterRatio, 1);
  assert.equal(
    createHash('sha256')
      .update(await readFile(fixture))
      .digest('hex'),
    originalHash,
  );
  assert.equal(
    evidence.requestedOptions.standardFontDataUrl,
    'local-cbt://app/pdfjs/standard_fonts/',
  );
  await adapter.dispose();
});
