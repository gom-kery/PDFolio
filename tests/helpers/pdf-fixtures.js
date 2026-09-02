import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_PDF_FILE_BYTES } from '../../electron/pdf-file.js';

function serializePdf(objects) {
  let pdf = '%PDF-1.7\n% Local PDF CBT synthetic input\n';
  const offsets = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  const size = objects.length + 1;
  pdf += `xref\n0 ${size}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

/** An original, blank single-page PDF with byte-accurate xref offsets; no user content. */
export function blankPdf() {
  return serializePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
  ]);
}

/** Distinct vector colors make the final rendered page observable without user data. */
export function pagedPdf(pageCount = 5) {
  const colors = [
    '0.75 0.15 0.15',
    '0.15 0.55 0.25',
    '0.15 0.35 0.75',
    '0.65 0.25 0.70',
    '0.90 0.55 0.10',
  ];
  const pageObjectNumbers = Array.from(
    { length: pageCount },
    (_, index) => 3 + index * 2,
  );
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pageCount} >>`,
  ];
  for (const [index, pageObjectNumber] of pageObjectNumbers.entries()) {
    const contentObjectNumber = pageObjectNumber + 1;
    const content = `q\n${colors[index % colors.length]} rg\n20 20 460 660 re\nf\nQ\n`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 700] /Resources << >> /Contents ${contentObjectNumber} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
    );
  }
  return serializePdf(objects);
}

/** A landscape source page whose intrinsic 90 degree rotation must swap the viewport. */
export function rotatedPdf() {
  const content = 'q\n0.15 0.35 0.75 rg\n10 10 220 100 re\nf\nQ\n';
  return serializePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 120] /Rotate 90 /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  ]);
}

/** Four text pages share an offset box/UserUnit while intrinsic rotation changes. */
export function coordinatePdf() {
  const rotations = [0, 90, 180, 270];
  const pageObjectNumbers = rotations.map((_, index) => 4 + index * 2);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count 4 >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  for (const [index, rotation] of rotations.entries()) {
    const contentObjectNumber = pageObjectNumbers[index] + 1;
    const content =
      'BT\n/F1 12 Tf\n1 0 0 1 30 60 Tm\n(Coordinate sample) Tj\nET\n';
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [10 20 210 320] /CropBox [10 20 210 320] /UserUnit 2 /Rotate ${rotation} /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
    );
  }
  return serializePdf(objects);
}

/** Text lines include one heading and two deliberate English false positives. */
export function keywordPdf() {
  const content = [
    'BT',
    '/F1 12 Tf',
    '1 0 0 1 25 170 Tm',
    '(Question body mentions Answer in a sentence.) Tj',
    '0 -24 Td',
    '(Answer choices are A through D.) Tj',
    '0 -24 Td',
    '(Explanation: worked result.) Tj',
    'ET',
    '',
  ].join('\n');
  return serializePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  ]);
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
    multipage: path.join(directory, '페이지 이동.pdf'),
    rotated: path.join(directory, '고유 회전.pdf'),
    keyword: path.join(directory, '키워드 후보.pdf'),
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
    ['multipage', pagedPdf()],
    ['rotated', rotatedPdf()],
    ['keyword', keywordPdf()],
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
