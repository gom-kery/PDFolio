import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
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

test('PDF adapter renders only page 1 with local same-version asset URLs', async () => {
  const evidence = { cleanup: 0, destroyed: 0 };
  const page = {
    getViewport: ({ scale }) => {
      assert.equal(scale, 1);
      return { width: 210.5, height: 297.5 };
    },
    render: (parameters) => {
      evidence.render = parameters;
      return { promise: Promise.resolve(), cancel: () => assert.fail() };
    },
    cleanup: () => evidence.cleanup++,
  };
  const pdfDocument = {
    numPages: 7,
    getPage: async (number) => {
      assert.equal(number, 1);
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
  await adapter.dispose();
  assert.equal(evidence.destroyed, 1);
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
            getViewport: () => ({ width: 100, height: 100 }),
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
