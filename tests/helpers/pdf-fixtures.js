import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_PDF_FILE_BYTES } from '../../electron/pdf-file.js';

/** An original, blank single-page PDF with byte-accurate xref offsets; no user content. */
export function blankPdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
  ];
  let pdf = '%PDF-1.7\n% Local PDF CBT synthetic input\n';
  const offsets = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

/** Create bounded input cases in the caller's test directory, never in user document folders. */
export async function createPdfFixtures(directory) {
  await mkdir(directory, { recursive: true });
  const fixtureDirectory = fileURLToPath(
    new URL('../fixtures/', import.meta.url),
  );
  const renderedFixture = await readFile(
    path.join(fixtureDirectory, 'unit-1.3-korean-image.pdf'),
  );
  const passwordFixture = await readFile(
    path.join(fixtureDirectory, 'unit-1.3-password.pdf'),
  );
  const files = {
    valid: path.join(directory, '한글 문서 & 연습.PDF'),
    replacement: path.join(directory, '다른 문서.pdf'),
    renamed: path.join(directory, '이름만 PDF.pdf'),
    text: path.join(directory, '일반 문서.txt'),
    empty: path.join(directory, '빈 파일.pdf'),
    short: path.join(directory, '짧은 파일.pdf'),
    headerOnly: path.join(directory, '구조 검사 미완료.pdf'),
    password: path.join(directory, '암호 필요.pdf'),
    highBit: path.join(directory, '서명 변조.pdf'),
    oversized: path.join(directory, '상한 초과.pdf'),
    boundary: path.join(directory, '상한 일치.pdf'),
    folder: path.join(directory, '폴더.pdf'),
  };
  for (const [name, content] of [
    ['valid', renderedFixture],
    ['replacement', blankPdf()],
    ['renamed', 'NOT A PDF'],
    ['text', blankPdf()],
    ['empty', ''],
    ['short', '%PDF-1'],
    ['headerOnly', '%PDF-1.7\n'],
    ['password', passwordFixture],
    [
      'highBit',
      Buffer.from([0xa5, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]),
    ],
  ])
    await writeFile(files[name], content);
  await mkdir(files.folder);
  for (const [name, size] of [
    ['oversized', MAX_PDF_FILE_BYTES + 1],
    ['boundary', MAX_PDF_FILE_BYTES],
  ]) {
    const handle = await open(files[name], 'w');
    try {
      await handle.write(blankPdf());
      await handle.truncate(size);
    } finally {
      await handle.close();
    }
  }
  return files;
}
