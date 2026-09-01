import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assessPageText,
  MIN_READABLE_CHARACTER_RATIO,
  MIN_USABLE_NON_WHITESPACE_CHARACTERS,
} from '../src/analysis/page-text-assessment.js';

function source(items = []) {
  const normalizedItems = items.map((item, sourceIndex) => ({
    sourceIndex,
    sourceText: item.sourceText,
    direction: 'ltr',
    transform: [12, 0, 0, 12, 30, 160 - sourceIndex * 20],
    width: 100,
    height: 12,
    fontName: 'fixture-font',
    hasEOL: item.hasEOL ?? false,
  }));
  return {
    contractVersion: 1,
    documentRevision: 4,
    pageNumber: 2,
    pageCount: 5,
    language: 'ko',
    page: { viewBox: [0, 0, 200, 200], userUnit: 1, rotation: 0 },
    items: normalizedItems,
    styles: normalizedItems.length
      ? [
          {
            fontName: 'fixture-font',
            ascent: 0.9,
            descent: -0.2,
            vertical: false,
            fontFamily: 'sans-serif',
          },
        ]
      : [],
  };
}

test('Korean split items and mixed-page text stay usable without invented spaces', () => {
  const assessment = assessPageText(
    source([
      { sourceText: '전기' },
      { sourceText: '기능사 ' },
      {
        sourceText: '한글 텍스트와 이미지가 함께 있는 페이지입니다.',
        hasEOL: true,
      },
      { sourceText: '다음 줄도 원래 항목 순서를 유지합니다.' },
    ]),
  );
  assert.equal(assessment.quality, 'text-usable');
  assert.deepEqual(assessment.reasonCodes, []);
  assert.equal(
    assessment.plainText,
    '전기기능사 한글 텍스트와 이미지가 함께 있는 페이지입니다.\n다음 줄도 원래 항목 순서를 유지합니다.',
  );
  assert.ok(
    assessment.metrics.nonWhitespaceCharacterCount >=
      MIN_USABLE_NON_WHITESPACE_CHARACTERS,
  );
  assert.equal(assessment.metrics.readableCharacterRatio, 1);
});

test('empty, vector or image-only pages and whitespace-only pages are insufficient', () => {
  const empty = assessPageText(source());
  assert.equal(empty.quality, 'text-insufficient');
  assert.deepEqual(empty.reasonCodes, ['NO_TEXT_ITEMS']);
  assert.equal(empty.plainText, '');

  const whitespace = assessPageText(
    source([{ sourceText: ' \t', hasEOL: true }, { sourceText: '  ' }]),
  );
  assert.equal(whitespace.quality, 'text-insufficient');
  assert.deepEqual(whitespace.reasonCodes, ['WHITESPACE_ONLY']);
  assert.equal(whitespace.plainText, ' \t\n  ');
});

test('page-number-level text is too little and abnormal strings have low quality', () => {
  const pageNumber = assessPageText(source([{ sourceText: '12' }]));
  assert.equal(pageNumber.quality, 'text-insufficient');
  assert.deepEqual(pageNumber.reasonCodes, ['TOO_LITTLE_TEXT']);

  const abnormal = assessPageText(
    source([
      { sourceText: '\ufffd'.repeat(MIN_USABLE_NON_WHITESPACE_CHARACTERS) },
    ]),
  );
  assert.equal(abnormal.quality, 'text-insufficient');
  assert.deepEqual(abnormal.reasonCodes, ['LOW_TEXT_QUALITY']);
  assert.equal(abnormal.metrics.readableCharacterRatio, 0);
});

test('enough readable text mixed with many suspicious characters stays unknown', () => {
  const readable = '가'.repeat(MIN_USABLE_NON_WHITESPACE_CHARACTERS);
  const suspicious = '\ufffd'.repeat(MIN_USABLE_NON_WHITESPACE_CHARACTERS);
  const assessment = assessPageText(
    source([{ sourceText: readable + suspicious }]),
  );
  assert.equal(assessment.quality, 'unknown');
  assert.deepEqual(assessment.reasonCodes, [
    'LOW_TEXT_QUALITY',
    'CONFLICTING_SIGNALS',
  ]);
  assert.ok(
    assessment.metrics.readableCharacterRatio < MIN_READABLE_CHARACTER_RATIO,
  );
});

test('malformed sources and extraction failures are unknown without inferred text', () => {
  const malformed = source([{ sourceText: '유효해 보이는 텍스트입니다.' }]);
  malformed.items[0].transform = [1, 0];
  const invalidAssessment = assessPageText(malformed);
  assert.equal(invalidAssessment.quality, 'unknown');
  assert.deepEqual(invalidAssessment.reasonCodes, ['INVALID_TEXT_SOURCE']);
  assert.equal(invalidAssessment.plainText, '');

  const extractionFailure = assessPageText({
    status: 'error',
    code: 'TEXT_EXTRACTION_FAILED',
    documentRevision: 4,
    pageNumber: 2,
  });
  assert.equal(extractionFailure.quality, 'unknown');
  assert.deepEqual(extractionFailure.reasonCodes, ['TEXT_EXTRACTION_FAILED']);
  assert.equal(extractionFailure.plainText, '');
});

test('canceled, no-document and invalid-page results do not create assessments', () => {
  assert.equal(assessPageText({ status: 'canceled', code: 'CANCELED' }), null);
  for (const code of ['NO_DOCUMENT', 'INVALID_PAGE_NUMBER']) {
    assert.equal(
      assessPageText({
        status: 'error',
        code,
        documentRevision: 4,
        pageNumber: 2,
      }),
      null,
    );
  }
});
