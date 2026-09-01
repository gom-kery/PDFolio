import './styles/base.css';
import './styles/shell.css';
import { renderRuntimeStatus } from './ui/runtime-status.js';
import { initializePdfSelection } from './ui/pdf-selection.js';

renderRuntimeStatus(
  document.querySelector('#runtime-status'),
  window.localPdfCbt?.runtimeInfo,
);
initializePdfSelection(document, window.localPdfCbt);
