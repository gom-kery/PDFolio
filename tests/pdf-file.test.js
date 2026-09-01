import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  inspectPdfFile,
  isLocalFilePath,
  MAX_PDF_FILE_BYTES,
} from '../electron/pdf-file.js';
import { createPdfFixtures } from './helpers/pdf-fixtures.js';

let files;
before(async () => {
  const root = fileURLToPath(
    new URL('../work/pdf-file-tests/', import.meta.url),
  );
  await mkdir(root, { recursive: true });
  files = await createPdfFixtures(await mkdtemp(path.join(root, 'case-')));
});

test('selected Unicode/uppercase PDF returns only metadata and leaves original bytes/time unchanged', async () => {
  const hash = async () =>
    createHash('sha256')
      .update(await readFile(files.valid))
      .digest('hex');
  const beforeHash = await hash();
  const beforeStat = await stat(files.valid);
  assert.deepEqual(await inspectPdfFile(files.valid), {
    status: 'selected',
    document: { name: '한글 문서 & 연습.PDF', sizeBytes: beforeStat.size },
  });
  assert.equal(await hash(), beforeHash);
  assert.equal((await stat(files.valid)).mtimeMs, beforeStat.mtimeMs);
});

for (const [name, code] of [
  ['renamed', 'NOT_PDF'],
  ['text', 'NOT_PDF'],
  ['empty', 'EMPTY_FILE'],
  ['short', 'NOT_PDF'],
  ['highBit', 'NOT_PDF'],
  ['oversized', 'FILE_TOO_LARGE'],
  ['folder', 'NOT_A_FILE'],
])
  test(`reject ${name}`, async () => {
    assert.deepEqual(await inspectPdfFile(files[name]), {
      status: 'error',
      code,
    });
  });

test('exact 50 MiB boundary is accepted; header acceptance does not claim structural validity', async () => {
  assert.equal(
    (await inspectPdfFile(files.boundary)).document.sizeBytes,
    MAX_PDF_FILE_BYTES,
  );
  assert.equal((await inspectPdfFile(files.headerOnly)).status, 'selected');
});

test('reject UNC/device/relative/alternate-stream paths before any filesystem work', async () => {
  for (const value of [
    'relative.pdf',
    'C:relative.pdf',
    '\\server\\file.pdf',
    '\\\\server\\share\\file.pdf',
    '\\\\?\\C:\\file.pdf',
    'C:\\file.pdf:stream',
    'C:\\NUL.pdf',
    'C:\\COM1.pdf',
    'C:\\a\0.pdf',
    'file:///C:/a.pdf',
  ]) {
    assert.equal(isLocalFilePath(value), false, value);
    assert.equal(
      (
        await inspectPdfFile(value, {
          resolvePath: () => {
            assert.fail('Unexpected filesystem access');
          },
        })
      ).code,
      'LOCAL_FILE_REQUIRED',
    );
  }
});

test('reject a resolved network target without opening it', async () => {
  const result = await inspectPdfFile('C:\\selected.pdf', {
    resolvePath: async () => '\\\\server\\share\\private.pdf',
    openFile: () => assert.fail('Must not open network target'),
  });
  assert.equal(result.code, 'LOCAL_FILE_REQUIRED');
});

test('read-only handle reads at most nine bytes, supports short reads and closes on success', async () => {
  let closed = 0;
  let readBytes = 0;
  const header = Buffer.from('%PDF-2.0\r');
  const result = await inspectPdfFile('C:\\selected.pdf', {
    resolvePath: async (value) => value,
    openFile: async (value, flags) => {
      assert.equal(value, 'C:\\selected.pdf');
      assert.equal(flags, 'r');
      return {
        stat: async () => ({ isFile: () => true, size: 100, mtimeMs: 1 }),
        read: async (buffer, offset, length, position) => {
          const count = Math.min(length, 2);
          header.copy(buffer, offset, position, position + count);
          readBytes += count;
          return { bytesRead: count };
        },
        close: async () => {
          closed++;
        },
      };
    },
  });
  assert.equal(result.status, 'selected');
  assert.equal(readBytes, 9);
  assert.equal(closed, 1);
});

test('concurrent file change is rejected and a read failure still closes its handle', async () => {
  for (const failure of [false, true]) {
    let calls = 0;
    let closed = false;
    const operation = inspectPdfFile('C:\\selected.pdf', {
      resolvePath: async (value) => value,
      openFile: async () => ({
        stat: async () => ({ isFile: () => true, size: 100, mtimeMs: calls++ }),
        read: async (buffer) => {
          if (failure)
            throw Object.assign(new Error('Private path must not leak'), {
              code: 'EACCES',
            });
          buffer.write('%PDF-1.7\n');
          return { bytesRead: 9 };
        },
        close: async () => {
          closed = true;
        },
      }),
    });
    if (failure) await assert.rejects(operation, { code: 'EACCES' });
    else assert.equal((await operation).code, 'FILE_CHANGED');
    assert.equal(closed, true);
  }
});
