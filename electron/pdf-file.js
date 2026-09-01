import { open, realpath } from 'node:fs/promises';
import path from 'node:path';

// Temporary input guard, not a promise of PDF rendering performance.
export const MAX_PDF_FILE_BYTES = 50 * 1024 * 1024;
const HEADER_BYTES = 9;

/** Only ordinary absolute Windows paths; no UNC, device paths or alternate streams. */
export function isLocalFilePath(value) {
  return (
    typeof value === 'string' &&
    /^[a-z]:[\\/][^:\0]*$/iu.test(value) &&
    !/(?:^|[\\/])(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|[\\/]|$)/iu.test(
      value,
    )
  );
}

/** Map filesystem failures to public codes without leaking paths or file contents. */
export function fileFailure(error) {
  if (['EACCES', 'EPERM'].includes(error?.code)) return 'ACCESS_DENIED';
  if (['ENOENT', 'ENOTDIR'].includes(error?.code)) return 'FILE_MISSING';
  if (['EBUSY', 'ETXTBSY'].includes(error?.code)) return 'FILE_BUSY';
  return 'READ_FAILED';
}

/**
 * Inspect only the selected file's metadata and first nine bytes, using a read-only handle.
 * Does not parse PDF structure, detect encryption, retain a handle or return a path/bytes.
 * @param {string} filePath - Path returned by the native picker, never by renderer input.
 * @param {{openFile?: typeof open, resolvePath?: typeof realpath}} io - Testable I/O boundary.
 * @returns {Promise<{status: 'selected', document: {name: string, sizeBytes: number}} | {status: 'error', code: string}>}
 * @throws Filesystem failures are mapped to public codes by the selection handler.
 */
export async function inspectPdfFile(
  filePath,
  { openFile = open, resolvePath = realpath } = {},
) {
  if (!isLocalFilePath(filePath))
    return { status: 'error', code: 'LOCAL_FILE_REQUIRED' };
  if (path.win32.extname(filePath).toLowerCase() !== '.pdf')
    return { status: 'error', code: 'NOT_PDF' };

  let handle;
  try {
    const resolved = await resolvePath(filePath);
    if (!isLocalFilePath(resolved))
      return { status: 'error', code: 'LOCAL_FILE_REQUIRED' };
    handle = await openFile(resolved, 'r');
    const before = await handle.stat();
    if (!before.isFile()) return { status: 'error', code: 'NOT_A_FILE' };
    if (before.size === 0) return { status: 'error', code: 'EMPTY_FILE' };
    if (before.size > MAX_PDF_FILE_BYTES)
      return { status: 'error', code: 'FILE_TOO_LARGE' };

    const header = Buffer.alloc(HEADER_BYTES);
    let offset = 0;
    while (offset < header.length) {
      const { bytesRead } = await handle.read(
        header,
        offset,
        header.length - offset,
        offset,
      );
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]$/u.test(header.toString('latin1')))
      return { status: 'error', code: 'NOT_PDF' };
    const after = await handle.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
      return { status: 'error', code: 'FILE_CHANGED' };
    return {
      status: 'selected',
      document: { name: path.win32.basename(filePath), sizeBytes: before.size },
    };
  } finally {
    await handle?.close();
  }
}
