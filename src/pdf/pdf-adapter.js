import {
  getDocument,
  GlobalWorkerOptions,
  InvalidPDFException,
  PasswordException,
  RenderingCancelledException,
} from 'pdfjs-dist/build/pdf.mjs';
import { createPdfAdapterCore } from './pdf-adapter-core.js';

GlobalWorkerOptions.workerSrc = new URL(
  '../../node_modules/pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).href;

const pdfjsApi = {
  getDocument,
  InvalidPDFException,
  PasswordException,
  RenderingCancelledException,
};

export function createPdfAdapter(options = {}) {
  return createPdfAdapterCore({ ...options, pdfjsApi });
}
