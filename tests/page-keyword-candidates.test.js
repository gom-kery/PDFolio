import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findPageKeywordCandidates,
  PAGE_HEADING_KEYWORDS,
} from '../src/analysis/page-keyword-candidates.js';
import { assessPageText } from '../src/analysis/page-text-assessment.js';

function item(sourceIndex, sourceText, hasEOL = true) {
  return {
    sourceIndex,
    sourceText,
    direction: 'ltr',
    transform: [10, 0, 0, 10, 10, 100 - sourceIndex * 12],
    width: Math.max(1, sourceText.length * 8),
    height: 10,
    fontName: 'font-1',
    hasEOL,
  };
}

function sourceFromLines(lines) {
  const items = lines.map((text, sourceIndex) => item(sourceIndex, text));
  return {
    contractVersion: 1,
    documentRevision: 7,
    pageNumber: 1,
    pageCount: 1,
    language: null,
    page: { viewBox: [0, 0, 200, 200], userUnit: 1, rotation: 0 },
    items,
    styles: [
      {
        fontName: 'font-1',
        ascent: 0.8,
        descent: -0.2,
        vertical: false,
        fontFamily: 'sans-serif',
      },
    ],
  };
}

function find(source) {
  return findPageKeywordCandidates({
    source,
    assessment: assessPageText(source),
  });
}

test('catalog contains only the seven approved Korean and English headings', () => {
  assert.deepEqual(
    PAGE_HEADING_KEYWORDS.map(({ canonicalKeyword }) => canonicalKeyword),
    ['Explanation', 'Solution', 'Answer', '해설', '풀이', '정답', '답'],
  );
});

test('finds approved headings with delimiters, content and answer values', () => {
  const result = find(
    sourceFromLines([
      '해설: 풀이 내용',
      '풀이 계산 과정',
      '정답: ③',
      '답 2번',
      'Answer: B',
      'Solution - details',
      'Explanation details',
    ]),
  );
  assert.equal(result.status, 'candidates-ready');
  assert.equal(result.result.candidateCount, 7);
  assert.deepEqual(
    result.result.candidates.map(
      ({ canonicalKeyword, kind, context, sourceLineNumber }) => ({
        canonicalKeyword,
        kind,
        context,
        sourceLineNumber,
      }),
    ),
    [
      {
        canonicalKeyword: '해설',
        kind: 'solution-heading',
        context: 'heading-with-delimiter',
        sourceLineNumber: 1,
      },
      {
        canonicalKeyword: '풀이',
        kind: 'solution-heading',
        context: 'heading-with-content',
        sourceLineNumber: 2,
      },
      {
        canonicalKeyword: '정답',
        kind: 'answer-heading',
        context: 'heading-with-delimiter',
        sourceLineNumber: 3,
      },
      {
        canonicalKeyword: '답',
        kind: 'answer-heading',
        context: 'heading-with-answer',
        sourceLineNumber: 4,
      },
      {
        canonicalKeyword: 'Answer',
        kind: 'answer-heading',
        context: 'heading-with-delimiter',
        sourceLineNumber: 5,
      },
      {
        canonicalKeyword: 'Solution',
        kind: 'solution-heading',
        context: 'heading-with-delimiter',
        sourceLineNumber: 6,
      },
      {
        canonicalKeyword: 'Explanation',
        kind: 'solution-heading',
        context: 'heading-with-content',
        sourceLineNumber: 7,
      },
    ],
  );
});

test('joins adjacent source items without inventing text and keeps evidence indexes', () => {
  const source = sourceFromLines(['placeholder']);
  source.items = [
    item(0, '• ', false),
    item(1, '정', false),
    item(2, '답', false),
    item(3, ': ④', true),
    item(4, '분석 가능한 길이를 충족하는 일반 본문입니다.', true),
  ];
  const result = find(source);
  assert.equal(result.status, 'candidates-ready');
  assert.deepEqual(result.result.candidates, [
    {
      canonicalKeyword: '정답',
      matchedText: '정답',
      kind: 'answer-heading',
      language: 'ko',
      context: 'heading-with-delimiter',
      matchMode: 'fragmented-items',
      sourceIndexes: [1, 2],
      sourceLineNumber: 1,
    },
  ]);
});

test('matches English headings case-insensitively across item fragments', () => {
  const source = sourceFromLines(['placeholder']);
  source.items = [
    item(0, 'expla', false),
    item(1, 'NATION', false),
    item(2, ': result', true),
  ];
  const result = find(source);
  assert.equal(result.result.candidateCount, 1);
  assert.equal(result.result.candidates[0].canonicalKeyword, 'Explanation');
  assert.equal(result.result.candidates[0].matchedText, 'explaNATION');
  assert.deepEqual(result.result.candidates[0].sourceIndexes, [0, 1]);
});

test('suppresses instruction phrases, longer words and embedded body keywords', () => {
  const result = find(
    sourceFromLines([
      '정답을 고르시오',
      '답변을 작성하세요',
      '해설서 목차',
      '풀이과정을 쓰시오',
      'This body contains Answer: C.',
      'Answer choices are A through D.',
      'Solution manual',
      'Explanation guide',
    ]),
  );
  assert.equal(result.status, 'candidates-ready');
  assert.equal(result.result.candidateCount, 0);
});

test('accepts standalone headings and Korean copula followed by an answer value', () => {
  const result = find(sourceFromLines(['정답은 ⑤입니다', '답', 'ANSWER is A']));
  assert.equal(result.result.candidateCount, 3);
  assert.deepEqual(
    result.result.candidates.map(({ canonicalKeyword, context }) => ({
      canonicalKeyword,
      context,
    })),
    [
      { canonicalKeyword: '정답', context: 'heading-with-answer' },
      { canonicalKeyword: '답', context: 'standalone-heading' },
      { canonicalKeyword: 'Answer', context: 'heading-with-answer' },
    ],
  );
});

test('returns a normal empty result when usable text has no heading candidate', () => {
  const result = find(
    sourceFromLines(['문제 본문에는 충분한 일반 텍스트만 있습니다.']),
  );
  assert.equal(result.status, 'candidates-ready');
  assert.equal(result.result.candidateCount, 0);
  assert.deepEqual(result.result.candidates, []);
});

test('skips insufficient and unknown text without searching it', () => {
  for (const source of [
    sourceFromLines(['1']),
    sourceFromLines(['\ufffd'.repeat(20)]),
  ]) {
    const assessment = assessPageText(source);
    const result = findPageKeywordCandidates({ source, assessment });
    assert.equal(result.status, 'skipped');
    assert.equal(result.code, 'TEXT_NOT_USABLE');
    assert.deepEqual(result.reasonCodes, assessment.reasonCodes);
  }
});

test('rejects mismatched assessment and malformed source without private data', () => {
  const source = sourceFromLines(['정답: 1 그리고 충분한 본문 텍스트']);
  const assessment = assessPageText(source);
  const mismatch = findPageKeywordCandidates({
    source,
    assessment: { ...assessment, pageNumber: 2 },
  });
  assert.equal(mismatch.status, 'error');
  assert.equal(mismatch.code, 'INVALID_PAGE_TEXT_ASSESSMENT');
  assert.ok(!Object.hasOwn(mismatch, 'text'));
  assert.deepEqual(findPageKeywordCandidates({ source: {} }), {
    status: 'error',
    code: 'INVALID_TEXT_SOURCE',
  });
});

test('candidate evidence excludes full surrounding lines, coordinates and regions', () => {
  const source = sourceFromLines([
    '정답: ② 비공개 전체 문장은 후보 결과에 포함하지 않습니다.',
  ]);
  const result = find(source);
  const candidate = result.result.candidates[0];
  assert.equal(candidate.matchedText, '정답');
  for (const excluded of [
    'lineText',
    'x',
    'y',
    'width',
    'height',
    'rect',
    'region',
    'questionId',
  ])
    assert.ok(!Object.hasOwn(candidate, excluded));
});
