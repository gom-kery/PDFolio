import { readPdfFile } from './pdf-file.js';
import {
  createPdfInputGate,
  inspectPdfInput,
  isTrustedPdfInputEvent,
} from './pdf-input.js';

export const PDF_SELECTION_CHANNEL = 'pdf:select-file';

/**
 * Bind a zero-argument picker to one trusted window's main frame.
 * Serialized requests prevent duplicate dialogs; cancellation/failure leave UI selection unchanged.
 * @param {{window: import('electron').BrowserWindow, rendererUrl: string,
 * showOpenDialog: Function, inspectFile?: typeof readPdfFile,
 * runExclusive?: Function}} options
 * @returns {Function} IPC invoke handler returning only public result records.
 */
export function createPdfSelectionHandler({
  window,
  rendererUrl,
  showOpenDialog,
  inspectFile = readPdfFile,
  runExclusive = createPdfInputGate(),
}) {
  return async (event, ...args) => {
    if (args.length || !isTrustedPdfInputEvent(event, window, rendererUrl))
      return { status: 'error', code: 'INVALID_REQUEST' };
    try {
      return await runExclusive(async () => {
        const selection = await showOpenDialog(window, {
          title: 'PDF 파일 선택',
          buttonLabel: '선택',
          filters: [{ name: 'PDF 문서', extensions: ['pdf'] }],
          properties: ['openFile', 'dontAddToRecent'],
        });
        // The native dialog may finish after the owning window/frame has gone away.
        if (
          !isTrustedPdfInputEvent(event, window, rendererUrl) ||
          selection.canceled
        )
          return { status: 'canceled' };
        if (
          !Array.isArray(selection.filePaths) ||
          selection.filePaths.length !== 1
        )
          return { status: 'error', code: 'ONE_FILE_REQUIRED' };
        const result = await inspectPdfInput(
          selection.filePaths[0],
          inspectFile,
        );
        return isTrustedPdfInputEvent(event, window, rendererUrl)
          ? result
          : { status: 'canceled' };
      });
    } catch {
      return { status: 'error', code: 'READ_FAILED' };
    }
  };
}
