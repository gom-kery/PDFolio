import {
  createPdfInputGate,
  inspectPdfInput,
  isTrustedPdfInputEvent,
} from './pdf-input.js';

export const PDF_DROP_CHANNEL = 'pdf:inspect-dropped-files';

/**
 * Validate paths derived by preload from real File objects, then reuse PDF inspection.
 * @param {{window: import('electron').BrowserWindow, rendererUrl: string,
 * inspectFile?: Function, runExclusive?: Function}} options
 */
export function createPdfDropHandler({
  window,
  rendererUrl,
  inspectFile,
  runExclusive = createPdfInputGate(),
}) {
  return async (event, ...args) => {
    if (
      args.length !== 1 ||
      !isTrustedPdfInputEvent(event, window, rendererUrl)
    )
      return { status: 'error', code: 'INVALID_REQUEST' };

    const [filePaths] = args;
    if (!Array.isArray(filePaths))
      return { status: 'error', code: 'INVALID_REQUEST' };
    if (filePaths.length === 0)
      return { status: 'error', code: 'NO_FILE_DROPPED' };
    if (filePaths.length !== 1)
      return { status: 'error', code: 'ONE_FILE_REQUIRED' };
    if (typeof filePaths[0] !== 'string')
      return { status: 'error', code: 'INVALID_REQUEST' };
    if (filePaths[0].length === 0)
      return { status: 'error', code: 'EMPTY_DROP_PATH' };

    try {
      return await runExclusive(async () => {
        if (!isTrustedPdfInputEvent(event, window, rendererUrl))
          return { status: 'canceled' };
        const result = await inspectPdfInput(filePaths[0], inspectFile);
        return isTrustedPdfInputEvent(event, window, rendererUrl)
          ? result
          : { status: 'canceled' };
      });
    } catch {
      return { status: 'error', code: 'READ_FAILED' };
    }
  };
}
