import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_CANVAS_DIMENSION,
  MAX_CANVAS_PIXELS,
  classifyPdfError,
  createPdfAdapterCore,
} from '../src/pdf/pdf-adapter-core.js';

class TestPasswordError extends Error {
  constructor() {
    super('password');
    this.name = 'PasswordException';
  }
}

class TestInvalidPdfError extends Error {
  constructor() {
    super('invalid');
    this.name = 'InvalidPDFException';
  }
}

class TestCanceledError extends Error {
  constructor() {
    super('canceled');
    this.name = 'RenderingCancelledException';
  }
}

const errorApi = {
  PasswordException: TestPasswordError,
  InvalidPDFException: TestInvalidPdfError,
  RenderingCancelledException: TestCanceledError,
};

test('PDF adapter opens page 1 and renders bounded page numbers with local assets', async () => {
  const evidence = { cleanup: 0, destroyed: 0 };
  const page = {
    getViewport: ({ scale }) => ({
      width: 210.5 * scale,
      height: 297.5 * scale,
      rotation: 0,
    }),
    render: (parameters) => {
      evidence.render = parameters;
      return { promise: Promise.resolve(), cancel: () => assert.fail() };
    },
    cleanup: () => evidence.cleanup++,
  };
  const pdfDocument = {
    numPages: 7,
    getPage: async (number) => {
      evidence.pageNumbers ||= [];
      evidence.pageNumbers.push(number);
      return page;
    },
    destroy: async () => evidence.destroyed++,
  };
  const pdfjsApi = {
    ...errorApi,
    getDocument: (options) => {
      evidence.options = options;
      return {
        promise: Promise.resolve(pdfDocument),
        destroy: () => assert.fail('Loaded document owns cleanup'),
      };
    },
  };
  const adapter = createPdfAdapterCore({
    pdfjsApi,
    assetBaseUrl: 'local-cbt://app/index.html',
  });
  const canvas = { style: {} };
  const data = Uint8Array.from([0x25, 0x50, 0x44, 0x46]);
  assert.deepEqual(await adapter.open({ data, canvas, pixelRatio: 2 }), {
    status: 'rendered',
    pageNumber: 1,
    pageCount: 7,
    width: 210.5,
    height: 297.5,
    scale: 1,
    rotation: 0,
    pixelRatio: 2,
    requestedPixelRatio: 2,
    resolutionLimited: false,
    canvasPixels: 250495,
  });
  assert.equal(evidence.options.data, data);
  assert.equal(evidence.options.verbosity, 0);
  assert.equal(evidence.options.cMapUrl, 'local-cbt://app/pdfjs/cmaps/');
  assert.equal(evidence.options.iccUrl, 'local-cbt://app/pdfjs/iccs/');
  assert.equal(
    evidence.options.standardFontDataUrl,
    'local-cbt://app/pdfjs/standard_fonts/',
  );
  assert.equal(evidence.options.wasmUrl, 'local-cbt://app/pdfjs/wasm/');
  assert.equal(evidence.options.useWasm, true);
  assert.equal(canvas.width, 421);
  assert.equal(canvas.height, 595);
  assert.equal(canvas.style.width, '210px');
  assert.equal(canvas.style.height, '297px');
  assert.equal(evidence.render.canvas, canvas);
  assert.deepEqual(evidence.render.transform, [2, 0, 0, 2, 0, 0]);
  assert.equal(evidence.cleanup, 1);
  for (const pageNumber of [0, 8, 1.5, Number.NaN])
    assert.deepEqual(await adapter.renderPage({ pageNumber, canvas }), {
      status: 'error',
      code: 'INVALID_PAGE_NUMBER',
      pageNumber: 1,
      pageCount: 7,
    });
  assert.deepEqual(await adapter.renderPage({ pageNumber: 7, canvas }), {
    status: 'rendered',
    pageNumber: 7,
    pageCount: 7,
    width: 210.5,
    height: 297.5,
    scale: 1,
    rotation: 0,
    pixelRatio: 1,
    requestedPixelRatio: 1,
    resolutionLimited: false,
    canvasPixels: 62370,
  });
  assert.deepEqual(evidence.pageNumbers, [1, 7]);
  assert.equal(evidence.cleanup, 2);
  await adapter.dispose();
  assert.equal(evidence.destroyed, 1);
  assert.deepEqual(await adapter.renderPage({ pageNumber: 1, canvas }), {
    status: 'error',
    code: 'NO_DOCUMENT',
  });
});

test('scale, fit width, intrinsic rotation and Canvas limits are enforced', async () => {
  const renderParameters = [];
  const makePage = (pageNumber) => ({
    getViewport: ({ scale }) => ({
      width: (pageNumber === 1 ? 240 : 4000) * scale,
      height: (pageNumber === 1 ? 120 : 4000) * scale,
      rotation: pageNumber === 1 ? 90 : 0,
    }),
    render: (parameters) => {
      renderParameters.push(parameters);
      return { promise: Promise.resolve(), cancel: () => assert.fail() };
    },
    cleanup: () => {},
  });
  const adapter = createPdfAdapterCore({
    pdfjsApi: {
      ...errorApi,
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 2,
          getPage: async (pageNumber) => makePage(pageNumber),
          destroy: async () => {},
        }),
        destroy: () => assert.fail(),
      }),
    },
    assetBaseUrl: 'http://127.0.0.1:5173/',
  });
  const canvas = { style: {} };
  const opened = await adapter.open({ data: new Uint8Array(9), canvas });
  assert.equal(opened.rotation, 90);
  assert.equal(opened.scale, 1);

  const fitted = await adapter.renderPage({
    pageNumber: 1,
    canvas,
    fitWidth: 360,
  });
  assert.equal(fitted.scale, 1.5);
  assert.equal(fitted.width, 360);
  assert.equal(fitted.height, 180);
  assert.equal(fitted.rotation, 90);

  for (const scale of [0.49, 2.01, Number.NaN])
    assert.equal(
      (await adapter.renderPage({ pageNumber: 1, canvas, scale })).code,
      'INVALID_SCALE',
    );
  assert.equal(
    (await adapter.renderPage({ pageNumber: 1, canvas, fitWidth: 0 })).code,
    'INVALID_SCALE',
  );

  const limited = await adapter.renderPage({
    pageNumber: 2,
    canvas,
    scale: 2,
    pixelRatio: 4,
  });
  assert.equal(limited.scale, 2);
  assert.equal(limited.requestedPixelRatio, 4);
  assert.equal(limited.resolutionLimited, true);
  assert.ok(limited.pixelRatio < 1);
  assert.ok(limited.canvasPixels <= MAX_CANVAS_PIXELS);
  assert.ok(canvas.width <= MAX_CANVAS_DIMENSION);
  assert.ok(canvas.height <= MAX_CANVAS_DIMENSION);
  assert.equal(canvas.style.width, '8000px');
  assert.equal(canvas.style.height, '8000px');
  assert.equal(renderParameters.at(-1).viewport.width, 8000);
  await adapter.dispose();
});

test('PDF parser failures become stable public states', async () => {
  assert.equal(
    classifyPdfError(new TestPasswordError(), errorApi),
    'PASSWORD_REQUIRED',
  );
  assert.equal(
    classifyPdfError(new TestInvalidPdfError(), errorApi),
    'INVALID_PDF_STRUCTURE',
  );
  assert.equal(classifyPdfError(new TestCanceledError(), errorApi), 'CANCELED');
  assert.equal(
    classifyPdfError(new Error('private detail'), errorApi),
    'PDF_RENDER_FAILED',
  );

  let destroyed = 0;
  const adapter = createPdfAdapterCore({
    pdfjsApi: {
      ...errorApi,
      getDocument: () => ({
        promise: Promise.reject(new TestPasswordError()),
        destroy: async () => destroyed++,
      }),
    },
    assetBaseUrl: 'http://127.0.0.1:5173/',
  });
  assert.deepEqual(
    await adapter.open({ data: new Uint8Array(9), canvas: { style: {} } }),
    { status: 'error', code: 'PASSWORD_REQUIRED' },
  );
  assert.equal(destroyed, 1);
});

test('rapid page requests cancel older work and keep the newest page', async () => {
  let rejectPageTwo;
  let pageTwoStarted;
  const pageTwoReady = new Promise((resolve) => (pageTwoStarted = resolve));
  const evidence = { canceled: [], cleanup: [] };
  const makePage = (pageNumber) => ({
    getViewport: ({ scale }) => ({
      width: (100 + pageNumber) * scale,
      height: 200 * scale,
      rotation: 0,
    }),
    render: () => {
      if (pageNumber !== 2)
        return { promise: Promise.resolve(), cancel: () => assert.fail() };
      pageTwoStarted();
      return {
        promise: new Promise((_, reject) => (rejectPageTwo = reject)),
        cancel: () => {
          evidence.canceled.push(pageNumber);
          rejectPageTwo(new TestCanceledError());
        },
      };
    },
    cleanup: () => evidence.cleanup.push(pageNumber),
  });
  const adapter = createPdfAdapterCore({
    pdfjsApi: {
      ...errorApi,
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 4,
          getPage: async (pageNumber) => makePage(pageNumber),
          destroy: async () => {},
        }),
        destroy: () => assert.fail(),
      }),
    },
    assetBaseUrl: 'http://127.0.0.1:5173/',
  });
  const canvas = { style: {} };
  assert.equal(
    (await adapter.open({ data: new Uint8Array(9), canvas })).pageNumber,
    1,
  );
  const pageTwo = adapter.renderPage({ pageNumber: 2, canvas, scale: 1.25 });
  await pageTwoReady;
  const pageFour = adapter.renderPage({ pageNumber: 4, canvas, scale: 1.5 });
  assert.deepEqual(await pageTwo, { status: 'canceled', code: 'CANCELED' });
  assert.deepEqual(await pageFour, {
    status: 'rendered',
    pageNumber: 4,
    pageCount: 4,
    width: 156,
    height: 300,
    scale: 1.5,
    rotation: 0,
    pixelRatio: 1,
    requestedPixelRatio: 1,
    resolutionLimited: false,
    canvasPixels: 46800,
  });
  assert.deepEqual(evidence.canceled, [2]);
  assert.deepEqual(evidence.cleanup, [1, 4]);
  const latePageTwo = adapter.renderPage({ pageNumber: 2, canvas });
  assert.deepEqual(await adapter.renderPage({ pageNumber: 0, canvas }), {
    status: 'error',
    code: 'INVALID_PAGE_NUMBER',
    pageNumber: 4,
    pageCount: 4,
  });
  assert.deepEqual(await latePageTwo, {
    status: 'canceled',
    code: 'CANCELED',
  });
  assert.deepEqual(evidence.cleanup, [1, 4, 2]);
  await adapter.dispose();
});

test('disposing an in-flight render cancels it and prevents a late result', async () => {
  let rejectRender;
  let renderStarted;
  const started = new Promise((resolve) => (renderStarted = resolve));
  let renderCanceled = 0;
  let documentDestroyed = 0;
  const adapter = createPdfAdapterCore({
    pdfjsApi: {
      ...errorApi,
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getViewport: ({ scale }) => ({
              width: 100 * scale,
              height: 100 * scale,
              rotation: 0,
            }),
            render: () => {
              renderStarted();
              return {
                promise: new Promise((_, reject) => (rejectRender = reject)),
                cancel: () => {
                  renderCanceled++;
                  rejectRender(new TestCanceledError());
                },
              };
            },
            cleanup: () => assert.fail('Canceled pages are not completed'),
          }),
          destroy: async () => documentDestroyed++,
        }),
        destroy: () => assert.fail(),
      }),
    },
    assetBaseUrl: 'http://127.0.0.1:5173/',
  });
  const pending = adapter.open({
    data: new Uint8Array(9),
    canvas: { style: {} },
  });
  await started;
  await adapter.dispose();
  assert.deepEqual(await pending, { status: 'canceled', code: 'CANCELED' });
  assert.equal(renderCanceled, 1);
  assert.equal(documentDestroyed, 1);
});
