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
import { createPageTextCoordinates } from '../src/analysis/page-text-coordinates.js';
import { findPageKeywordCandidates } from '../src/analysis/page-keyword-candidates.js';
import { createPdfAdapterCore } from '../src/pdf/pdf-adapter-core.js';
import {
  convertPdfPointToViewport,
  createViewportGeometry,
} from '../src/pdf/pdf-coordinate-space.js';
import { coordinatePdf, keywordPdf } from './helpers/pdf-fixtures.js';

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
        promise: loadingTask.promise.then((document) => {
          evidence.document = document;
          return {
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
          };
        }),
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
  const coordinates = createPageTextCoordinates(extraction.source);
  assert.equal(coordinates.status, 'coordinates-ready');
  assert.equal(coordinates.coordinates.items.length, 6);
  assert.ok(
    coordinates.coordinates.items.every(
      (item) =>
        Number.isFinite(item.x) &&
        Number.isFinite(item.y) &&
        item.width >= 0 &&
        item.height > 0,
    ),
  );
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

test('installed PDF.js agrees on offset, UserUnit, rotation and zoom projection', async () => {
  const original = coordinatePdf();
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

  let firstBox = null;
  for (const pageNumber of [1, 2, 3, 4]) {
    const extraction = await adapter.extractPageText({ pageNumber });
    assert.equal(extraction.status, 'extracted');
    assert.deepEqual(extraction.source.page.viewBox, [10, 20, 210, 320]);
    assert.equal(extraction.source.page.userUnit, 2);
    assert.equal(extraction.source.page.rotation, (pageNumber - 1) * 90);
    const coordinateResult = createPageTextCoordinates(extraction.source);
    assert.equal(coordinateResult.status, 'coordinates-ready');
    assert.equal(coordinateResult.coordinates.items.length, 1);
    const box = coordinateResult.coordinates.items[0];
    const comparableBox = {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    };
    if (firstBox === null) firstBox = comparableBox;
    else assert.deepEqual(comparableBox, firstBox);

    const pdfPage = await evidence.document.getPage(pageNumber);
    for (const scale of [0.5, 1, 2]) {
      const expected = pdfPage.getViewport({ scale });
      const actual = createViewportGeometry(extraction.source.page, { scale });
      assert.deepEqual(actual.transform, expected.transform);
      assert.equal(actual.width, expected.width);
      assert.equal(actual.height, expected.height);
      const expectedPoint = expected.convertToViewportPoint(box.x, box.y);
      const actualPoint = convertPdfPointToViewport(actual, box.x, box.y);
      assert.deepEqual(actualPoint, expectedPoint);
      assert.ok(!Object.hasOwn(actual, 'devicePixelRatio'));
    }
  }

  assert.equal(
    createHash('sha256').update(original).digest('hex'),
    originalHash,
  );
  await adapter.dispose();
});

test('installed PDF.js finds only the contextual heading in the keyword fixture', async () => {
  const original = keywordPdf();
  const originalHash = createHash('sha256').update(original).digest('hex');
  const adapter = createPdfAdapterCore({
    pdfjsApi: wrapPdfJsForTextExtraction({}),
    assetBaseUrl: 'local-cbt://app/index.html',
  });
  const opened = await adapter.open({
    data: new Uint8Array(original),
    canvas: { style: {} },
  });
  assert.equal(opened.status, 'rendered');

  const extraction = await adapter.extractPageText({ pageNumber: 1 });
  assert.equal(extraction.status, 'extracted');
  const assessment = assessPageText(extraction);
  assert.equal(assessment.quality, 'text-usable');
  const coordinates = createPageTextCoordinates(extraction.source);
  assert.equal(coordinates.status, 'coordinates-ready');

  const keywordResult = findPageKeywordCandidates({
    source: extraction.source,
    assessment,
  });
  assert.equal(keywordResult.status, 'candidates-ready');
  assert.equal(keywordResult.result.candidateCount, 1);
  assert.equal(
    keywordResult.result.candidates[0].canonicalKeyword,
    'Explanation',
  );
  assert.equal(
    keywordResult.result.candidates[0].context,
    'heading-with-delimiter',
  );
  assert.ok(!Object.hasOwn(keywordResult.result.candidates[0], 'lineText'));
  assert.equal(
    createHash('sha256').update(original).digest('hex'),
    originalHash,
  );
  await adapter.dispose();
});
