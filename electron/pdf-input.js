import { fileFailure, inspectPdfFile } from './pdf-file.js';

/** Confirm that a PDF input request came from the bound window's current main frame. */
export function isTrustedPdfInputEvent(event, window, rendererUrl) {
  try {
    const frame = event.senderFrame;
    return (
      !window.isDestroyed() &&
      !window.webContents.isDestroyed() &&
      event.sender === window.webContents &&
      frame === window.webContents.mainFrame &&
      frame.url === rendererUrl
    );
  } catch {
    return false;
  }
}

/** Serialize native selection and drop inspection so a late result cannot win a race. */
export function createPdfInputGate() {
  let isBusy = false;
  return async (operation) => {
    if (isBusy) return { status: 'busy' };
    isBusy = true;
    try {
      return await operation();
    } finally {
      isBusy = false;
    }
  };
}

/** Use the Unit 1.1 read-only inspection path and map private I/O failures. */
export async function inspectPdfInput(filePath, inspectFile = inspectPdfFile) {
  try {
    return await inspectFile(filePath);
  } catch (error) {
    return { status: 'error', code: fileFailure(error) };
  }
}
