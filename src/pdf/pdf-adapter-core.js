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
  let requestId = 0;
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

  return {
    async open({
      data,
      canvas,
      pixelRatio = globalThis.devicePixelRatio || 1,
    }) {
      const ownRequestId = ++requestId;
      await disposeCurrent();
      if (ownRequestId !== requestId)
        return { status: 'canceled', code: 'CANCELED' };

      const record = {
        requestId: ownRequestId,
        loadingTask: null,
        document: null,
        renderTask: null,
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

        const page = await pdfDocument.getPage(1);
        if (current !== record) return { status: 'canceled', code: 'CANCELED' };
        const viewport = page.getViewport({ scale: 1 });
        const outputScale = Math.max(1, Number(pixelRatio) || 1);
        canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
        canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        record.renderTask = page.render({
          canvas,
          viewport,
          transform:
            outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
        });
        await record.renderTask.promise;
        if (current !== record) return { status: 'canceled', code: 'CANCELED' };
        page.cleanup();
        record.renderTask = null;
        return {
          status: 'rendered',
          pageNumber: 1,
          pageCount: pdfDocument.numPages,
          width: viewport.width,
          height: viewport.height,
        };
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

    async dispose() {
      requestId++;
      await disposeCurrent();
    },
  };
}
