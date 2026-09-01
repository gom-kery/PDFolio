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

async function readPdfCandidate(
  filePath,
  includeData,
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

    const data = includeData ? Buffer.allocUnsafe(before.size) : null;
    const header =
      data?.subarray(0, HEADER_BYTES) || Buffer.alloc(HEADER_BYTES);
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

    if (data) {
      offset = HEADER_BYTES;
      while (offset < data.length) {
        const { bytesRead } = await handle.read(
          data,
          offset,
          data.length - offset,
          offset,
        );
        if (!bytesRead) break;
        offset += bytesRead;
      }
      if (offset !== data.length)
        return { status: 'error', code: 'FILE_CHANGED' };
    }

    const after = await handle.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
      return { status: 'error', code: 'FILE_CHANGED' };
    return {
      status: 'selected',
      document: { name: path.win32.basename(filePath), sizeBytes: before.size },
      ...(data ? { data: Uint8Array.from(data) } : {}),
    };
  } finally {
    await handle?.close();
  }
}

/**
 * Check metadata and the PDF header without retaining or returning content.
 * Kept as the narrow Unit 1.1 inspection boundary and for lightweight checks.
 */
export function inspectPdfFile(filePath, io) {
  return readPdfCandidate(filePath, false, io);
}

/**
 * Read one picker/drop-approved PDF through the same read-only guard.
 * The renderer receives bytes needed by PDF.js, never the local path.
 */
export function readPdfFile(filePath, io) {
  return readPdfCandidate(filePath, true, io);
}
