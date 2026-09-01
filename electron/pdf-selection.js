import { fileFailure, inspectPdfFile } from './pdf-file.js';

export const PDF_SELECTION_CHANNEL = 'pdf:select-file';

/**
 * Bind a zero-argument picker to one trusted window's main frame.
 * Serialized requests prevent duplicate dialogs; cancellation/failure leave UI selection unchanged.
 * @param {{window: import('electron').BrowserWindow, rendererUrl: string,
 * showOpenDialog: Function, inspectFile?: typeof inspectPdfFile}} options
 * @returns {Function} IPC invoke handler returning only public result records.
 */
export function createPdfSelectionHandler({
  window,
  rendererUrl,
  showOpenDialog,
  inspectFile = inspectPdfFile,
}) {
  let isSelecting = false;
  const isTrusted = (event) => {
    try {
      return (
        !window.isDestroyed() &&
        !window.webContents.isDestroyed() &&
        event.sender === window.webContents &&
        event.senderFrame === window.webContents.mainFrame &&
        event.senderFrame.url === rendererUrl
      );
    } catch {
      return false;
    }
  };
  return async (event, ...args) => {
    if (args.length || !isTrusted(event))
      return { status: 'error', code: 'INVALID_REQUEST' };
    if (isSelecting) return { status: 'busy' };
    isSelecting = true;
    try {
      const selection = await showOpenDialog(window, {
        title: 'PDF 파일 선택',
        buttonLabel: '선택',
        filters: [{ name: 'PDF 문서', extensions: ['pdf'] }],
        properties: ['openFile', 'dontAddToRecent'],
      });
      // The native dialog may finish after the owning window/frame has gone away.
      if (!isTrusted(event) || selection.canceled)
        return { status: 'canceled' };
      if (
        !Array.isArray(selection.filePaths) ||
        selection.filePaths.length !== 1
      )
        return { status: 'error', code: 'ONE_FILE_REQUIRED' };
      const result = await inspectFile(selection.filePaths[0]);
      return isTrusted(event) ? result : { status: 'canceled' };
    } catch (error) {
      return { status: 'error', code: fileFailure(error) };
    } finally {
      isSelecting = false;
    }
  };
}
