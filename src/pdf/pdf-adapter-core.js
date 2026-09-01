function isErrorType(error, constructor, name) {
  return (
    (typeof constructor === 'function' && error instanceof constructor) ||
    error?.name === name
  );
}

export function classifyPdfError(error, pdfjsApi = {}) {
  if (isErrorType(error, pdfjsApi.PasswordException, 'PasswordException'))
    return 'PASSWORD_REQUIRED';
  if (
    isErrorType(error, pdfjsApi.InvalidPDFException, 'InvalidPDFException') ||
    error?.name === 'MissingPDFException'
  )
    return 'INVALID_PDF_STRUCTURE';
  if (
    isErrorType(
      error,
      pdfjsApi.RenderingCancelledException,
      'RenderingCancelledException',
    ) ||
    error?.name === 'AbortException'
  )
    return 'CANCELED';
  return 'PDF_RENDER_FAILED';
}

function asUint8Array(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data))
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  throw new TypeError('PDF data must be binary');
}

/** Keep PDF.js objects inside this adapter and render one current page only. */
export function createPdfAdapterCore({
  pdfjsApi,
  assetBaseUrl = globalThis.document?.baseURI,
}) {
  let documentRequestId = 0;
  let renderRequestId = 0;
  let current = null;

  const disposeCurrent = async () => {
    const previous = current;
    current = null;
    try {
      previous?.renderTask?.cancel();
    } catch {
      // A completed PDF.js render may already have released its task.
    }
    try {
      if (previous?.document) await previous.document.destroy();
      else if (previous?.loadingTask) await previous.loadingTask.destroy();
    } catch {
      // Cleanup failure must not prevent a newly approved document from opening.
    }
  };

  const renderPage = async ({ record, pageNumber, canvas, pixelRatio }) => {
    const ownRenderRequestId = ++renderRequestId;
    try {
      record.renderTask?.cancel();
    } catch {
      // A completed PDF.js render may already have released its task.
    }
    record.renderTask = null;
    if (
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > record.pageCount
    )
      return {
        status: 'error',
        code: 'INVALID_PAGE_NUMBER',
        pageNumber: record.pageNumber,
        pageCount: record.pageCount,
      };

    let page;
    let task;
    try {
      page = await record.document.getPage(pageNumber);
      if (current !== record || ownRenderRequestId !== renderRequestId) {
        page.cleanup();
        return { status: 'canceled', code: 'CANCELED' };
      }

      const viewport = page.getViewport({ scale: 1 });
      const outputScale = Math.max(1, Number(pixelRatio) || 1);
      canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
      canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      task = page.render({
        canvas,
        viewport,
        transform:
          outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      });
      record.renderTask = task;
      await task.promise;
      if (current !== record || ownRenderRequestId !== renderRequestId) {
        page.cleanup();
        return { status: 'canceled', code: 'CANCELED' };
      }
      page.cleanup();
      if (record.renderTask === task) record.renderTask = null;
      record.pageNumber = pageNumber;
      record.width = viewport.width;
      record.height = viewport.height;
      return {
        status: 'rendered',
        pageNumber,
        pageCount: record.pageCount,
        width: viewport.width,
        height: viewport.height,
      };
    } catch (error) {
      if (current !== record || ownRenderRequestId !== renderRequestId)
        return { status: 'canceled', code: 'CANCELED' };
      if (record.renderTask === task) record.renderTask = null;
      const code = classifyPdfError(error, pdfjsApi);
      if (code !== 'CANCELED') {
        try {
          page?.cleanup();
        } catch {
          // Preserve the original public failure code.
        }
      }
      return { status: code === 'CANCELED' ? 'canceled' : 'error', code };
    }
  };

  return {
    async open({
      data,
      canvas,
      pixelRatio = globalThis.devicePixelRatio || 1,
    }) {
      const ownRequestId = ++documentRequestId;
      await disposeCurrent();
      if (ownRequestId !== documentRequestId)
        return { status: 'canceled', code: 'CANCELED' };

      const record = {
        loadingTask: null,
        document: null,
        renderTask: null,
        pageNumber: 0,
        pageCount: 0,
      };
      current = record;

      try {
        const base = new URL('pdfjs/', assetBaseUrl).href;
        record.loadingTask = pdfjsApi.getDocument({
          data: asUint8Array(data),
          verbosity: 0,
          cMapUrl: new URL('cmaps/', base).href,
          cMapPacked: true,
          iccUrl: new URL('iccs/', base).href,
          standardFontDataUrl: new URL('standard_fonts/', base).href,
          wasmUrl: new URL('wasm/', base).href,
          useWasm: true,
        });
        const pdfDocument = await record.loadingTask.promise;
        if (current !== record) {
          await pdfDocument.destroy();
          return { status: 'canceled', code: 'CANCELED' };
        }
        record.document = pdfDocument;
        record.pageCount = pdfDocument.numPages;
        const rendered = await renderPage({
          record,
          pageNumber: 1,
          canvas,
          pixelRatio,
        });
        if (rendered.status !== 'error') return rendered;
        if (current === record) current = null;
        try {
          await record.document.destroy();
        } catch {
          // Preserve the original public failure code.
        }
        return rendered;
      } catch (error) {
        if (current !== record) return { status: 'canceled', code: 'CANCELED' };
        const code = classifyPdfError(error, pdfjsApi);
        current = null;
        try {
          if (record.document) await record.document.destroy();
          else await record.loadingTask?.destroy();
        } catch {
          // Preserve the original public failure code.
        }
        return { status: code === 'CANCELED' ? 'canceled' : 'error', code };
      }
    },

    async renderPage({
      pageNumber,
      canvas,
      pixelRatio = globalThis.devicePixelRatio || 1,
    }) {
      const record = current;
      if (!record?.document) return { status: 'error', code: 'NO_DOCUMENT' };
      return renderPage({ record, pageNumber, canvas, pixelRatio });
    },

    async dispose() {
      documentRequestId++;
      renderRequestId++;
      await disposeCurrent();
    },
  };
}
