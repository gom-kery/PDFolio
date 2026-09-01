import './styles/base.css';
import './styles/shell.css';
import { renderRuntimeStatus } from './ui/runtime-status.js';
import { initializePdfSelection } from './ui/pdf-selection.js';
import { createPdfAdapter } from './pdf/pdf-adapter.js';
import { initializePdfViewer } from './ui/pdf-viewer.js';

renderRuntimeStatus(
  document.querySelector('#runtime-status'),
  window.localPdfCbt?.runtimeInfo,
);
const pdfViewer = initializePdfViewer(document, createPdfAdapter());
initializePdfSelection(document, window.localPdfCbt, {
  onPdfSelected: (result) => pdfViewer.open(result),
});
window.addEventListener('beforeunload', () => void pdfViewer.dispose());
