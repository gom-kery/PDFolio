import { PAGE_TEXT_CONTRACT_VERSION } from '../shared/page-text-contract.js';

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

function isFiniteNumberArray(value, length) {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every(Number.isFinite)
  );
}

function invalidTextSource() {
  return Object.assign(new Error('Invalid TextContent'), {
    code: 'INVALID_TEXT_SOURCE',
  });
}

function copyPageTextSource({ record, page, pageNumber, textContent }) {
  if (
    !textContent ||
    !Array.isArray(textContent.items) ||
    textContent.styles === null ||
    typeof textContent.styles !== 'object' ||
    !(textContent.lang === null || typeof textContent.lang === 'string') ||
    !isFiniteNumberArray(page.view, 4) ||
    !Number.isFinite(page.userUnit) ||
    page.userUnit <= 0 ||
    !Number.isFinite(page.rotate)
  )
    throw invalidTextSource();

  const items = textContent.items.map((item, sourceIndex) => {
    if (
      !item ||
      typeof item.str !== 'string' ||
      !['ltr', 'rtl', 'ttb'].includes(item.dir) ||
      !isFiniteNumberArray(item.transform, 6) ||
      !Number.isFinite(item.width) ||
      !Number.isFinite(item.height) ||
      typeof item.fontName !== 'string' ||
      typeof item.hasEOL !== 'boolean'
    )
      throw invalidTextSource();
    return {
      sourceIndex,
      sourceText: item.str,
      direction: item.dir,
      transform: [...item.transform],
      width: item.width,
      height: item.height,
      fontName: item.fontName,
      hasEOL: item.hasEOL,
    };
  });

  const referencedFonts = [];
  const seenFonts = new Set();
  for (const item of items) {
    if (seenFonts.has(item.fontName)) continue;
    seenFonts.add(item.fontName);
    referencedFonts.push(item.fontName);
  }
  const styles = referencedFonts.map((fontName) => {
    if (!Object.prototype.hasOwnProperty.call(textContent.styles, fontName))
      throw invalidTextSource();
    const style = textContent.styles[fontName];
    if (
      !style ||
      !Number.isFinite(style.ascent) ||
      !Number.isFinite(style.descent) ||
      typeof style.vertical !== 'boolean' ||
      typeof style.fontFamily !== 'string'
    )
      throw invalidTextSource();
    return {
      fontName,
      ascent: style.ascent,
      descent: style.descent,
      vertical: style.vertical,
      fontFamily: style.fontFamily,
    };
  });

  return {
    contractVersion: PAGE_TEXT_CONTRACT_VERSION,
    documentRevision: record.documentRevision,
    pageNumber,
    pageCount: record.pageCount,
    language: textContent.lang,
    page: {
      viewBox: [...page.view],
      userUnit: page.userUnit,
      rotation: page.rotate,
    },
    items,
    styles,
  };
}

export const MIN_RENDER_SCALE = 0.5;
export const MAX_RENDER_SCALE = 2;
export const MAX_CANVAS_PIXELS = 16_777_216;
export const MAX_CANVAS_DIMENSION = 8192;

function isValidScale(scale) {
  return (
    Number.isFinite(scale) &&
    scale >= MIN_RENDER_SCALE &&
    scale <= MAX_RENDER_SCALE
  );
}

function isValidFitHeight(fitHeight) {
  return Number.isFinite(fitHeight) && fitHeight > 0;
}

function resolveRenderScale({ baseHeight, scale, fitHeight }) {
  if (fitHeight !== undefined) {
    if (
      !isValidFitHeight(fitHeight) ||
      !Number.isFinite(baseHeight) ||
      baseHeight <= 0
    ) {
      return null;
    }
    return Math.min(
      MAX_RENDER_SCALE,
      Math.max(MIN_RENDER_SCALE, fitHeight / baseHeight),
    );
  }
  return isValidScale(scale) ? scale : null;
}

function resolveOutputScale({ cssWidth, cssHeight, requestedPixelRatio }) {
  const safePixelRatio = Number.isFinite(requestedPixelRatio)
    ? Math.max(1, requestedPixelRatio)
    : 1;
  const pixelLimitScale = Math.sqrt(MAX_CANVAS_PIXELS / (cssWidth * cssHeight));
  const dimensionLimitScale = Math.min(
    MAX_CANVAS_DIMENSION / cssWidth,
    MAX_CANVAS_DIMENSION / cssHeight,
  );
  const pixelRatio = Math.min(
    safePixelRatio,
    pixelLimitScale,
    dimensionLimitScale,
  );

  return {
    pixelRatio,
    requestedPixelRatio: safePixelRatio,
    resolutionLimited: pixelRatio < safePixelRatio,
  };
}

/** Keep PDF.js objects inside this adapter and render one current page only. */
export function createPdfAdapterCore({
  pdfjsApi,
  assetBaseUrl = globalThis.document?.baseURI,
}) {
  let documentRequestId = 0;
  let renderRequestId = 0;
  let textRequestId = 0;
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
      await previous?.loadingTask?.destroy();
    } catch {
      // Cleanup failure must not prevent a newly approved document from opening.
    }
  };

  const renderPage = async ({
    record,
    pageNumber,
    canvas,
    pixelRatio,
    scale,
    fitHeight,
  }) => {
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

    if (
      (fitHeight === undefined && !isValidScale(scale)) ||
      (fitHeight !== undefined && !isValidFitHeight(fitHeight))
    )
      return {
        status: 'error',
        code: 'INVALID_SCALE',
        pageNumber: record.pageNumber,
        pageCount: record.pageCount,
        minimumScale: MIN_RENDER_SCALE,
        maximumScale: MAX_RENDER_SCALE,
      };

    let page;
    let task;
    try {
      page = await record.document.getPage(pageNumber);
      if (current !== record || ownRenderRequestId !== renderRequestId) {
        page.cleanup();
        return { status: 'canceled', code: 'CANCELED' };
      }

      const baseViewport = page.getViewport({ scale: 1 });
      const renderScale = resolveRenderScale({
        baseHeight: baseViewport.height,
        scale,
        fitHeight,
      });
      if (renderScale === null) {
        page.cleanup();
        return {
          status: 'error',
          code: 'INVALID_SCALE',
          pageNumber: record.pageNumber,
          pageCount: record.pageCount,
          minimumScale: MIN_RENDER_SCALE,
          maximumScale: MAX_RENDER_SCALE,
        };
      }
      const viewport = page.getViewport({ scale: renderScale });
      const output = resolveOutputScale({
        cssWidth: viewport.width,
        cssHeight: viewport.height,
        requestedPixelRatio: pixelRatio,
      });
      canvas.width = Math.max(
        1,
        Math.floor(viewport.width * output.pixelRatio),
      );
      canvas.height = Math.max(
        1,
        Math.floor(viewport.height * output.pixelRatio),
      );
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      task = page.render({
        canvas,
        viewport,
        transform:
          output.pixelRatio === 1
            ? null
            : [output.pixelRatio, 0, 0, output.pixelRatio, 0, 0],
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
      record.scale = renderScale;
      return {
        status: 'rendered',
        pageNumber,
        pageCount: record.pageCount,
        width: viewport.width,
        height: viewport.height,
        scale: renderScale,
        rotation: viewport.rotation,
        pixelRatio: output.pixelRatio,
        requestedPixelRatio: output.requestedPixelRatio,
        resolutionLimited: output.resolutionLimited,
        canvasPixels: canvas.width * canvas.height,
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
      scale = 1,
      fitHeight,
    }) {
      const ownRequestId = ++documentRequestId;
      textRequestId++;
      await disposeCurrent();
      if (ownRequestId !== documentRequestId)
        return { status: 'canceled', code: 'CANCELED' };

      const record = {
        loadingTask: null,
        document: null,
        renderTask: null,
        documentRevision: ownRequestId,
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
          await record.loadingTask.destroy();
          return { status: 'canceled', code: 'CANCELED' };
        }
        record.document = pdfDocument;
        record.pageCount = pdfDocument.numPages;
        const rendered = await renderPage({
          record,
          pageNumber: 1,
          canvas,
          pixelRatio,
          scale,
          fitHeight,
        });
        if (rendered.status !== 'error') return rendered;
        if (current === record) current = null;
        try {
          await record.loadingTask.destroy();
        } catch {
          // Preserve the original public failure code.
        }
        return rendered;
      } catch (error) {
        if (current !== record) return { status: 'canceled', code: 'CANCELED' };
        const code = classifyPdfError(error, pdfjsApi);
        current = null;
        try {
          await record.loadingTask?.destroy();
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
      scale = 1,
      fitHeight,
    }) {
      const record = current;
      if (!record?.document) return { status: 'error', code: 'NO_DOCUMENT' };
      return renderPage({
        record,
        pageNumber,
        canvas,
        pixelRatio,
        scale,
        fitHeight,
      });
    },

    async extractPageText({ pageNumber }) {
      const record = current;
      if (!record?.document) return { status: 'error', code: 'NO_DOCUMENT' };
      if (
        !Number.isSafeInteger(pageNumber) ||
        pageNumber < 1 ||
        pageNumber > record.pageCount
      )
        return {
          status: 'error',
          code: 'INVALID_PAGE_NUMBER',
          documentRevision: record.documentRevision,
          pageNumber: record.pageNumber,
          pageCount: record.pageCount,
        };

      const ownTextRequestId = ++textRequestId;
      try {
        const page = await record.document.getPage(pageNumber);
        if (
          current !== record ||
          ownTextRequestId !== textRequestId ||
          record.documentRevision !== documentRequestId
        )
          return { status: 'canceled', code: 'CANCELED' };
        const textContent = await page.getTextContent({
          includeMarkedContent: false,
          disableNormalization: false,
        });
        if (
          current !== record ||
          ownTextRequestId !== textRequestId ||
          record.documentRevision !== documentRequestId
        )
          return { status: 'canceled', code: 'CANCELED' };
        try {
          return {
            status: 'extracted',
            source: copyPageTextSource({
              record,
              page,
              pageNumber,
              textContent,
            }),
          };
        } catch (error) {
          if (error?.code !== 'INVALID_TEXT_SOURCE') throw error;
          return {
            status: 'error',
            code: 'INVALID_TEXT_SOURCE',
            documentRevision: record.documentRevision,
            pageNumber,
          };
        }
      } catch (error) {
        if (
          current !== record ||
          ownTextRequestId !== textRequestId ||
          record.documentRevision !== documentRequestId
        )
          return { status: 'canceled', code: 'CANCELED' };
        const code = classifyPdfError(error, pdfjsApi);
        if (code === 'CANCELED')
          return { status: 'canceled', code: 'CANCELED' };
        return {
          status: 'error',
          code: 'TEXT_EXTRACTION_FAILED',
          documentRevision: record.documentRevision,
          pageNumber,
        };
      }
    },

    async dispose() {
      documentRequestId++;
      renderRequestId++;
      textRequestId++;
      await disposeCurrent();
    },
  };
}
