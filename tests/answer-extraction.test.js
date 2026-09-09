import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractManualAnswerValue } from '../src/cbt/answer-extraction.js';

function sourceFromLines(lines) {
  const items = lines.map((sourceText, sourceIndex) => ({
    sourceIndex,
    sourceText,
    direction: 'ltr',
    transform: [12, 0, 0, 12, 30, 200 - sourceIndex * 24],
    width: Math.max(12, sourceText.length * 6),
    height: 12,
    fontName: 'font-1',
    hasEOL: true,
  }));
  return {
    contractVersion: 1,
    documentRevision: 7,
    pageNumber: 1,
    pageCount: 1,
    language: 'ko',
    page: { viewBox: [0, 0, 300, 300], userUnit: 1, rotation: 0 },
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

function setup(
  lines,
  { choiceCount = 5, rect = { x: 20, y: 120, width: 240, height: 120 } } = {},
) {
  const source = sourceFromLines(lines);
  return {
    source,
    coordinates: {
      contractVersion: 1,
      documentRevision: 7,
      pageNumber: 1,
      coordinateSpace: 'pdf-user-space',
      items: source.items.map((item) => ({
        sourceIndex: item.sourceIndex,
        text: item.sourceText,
        x: 30,
        y: 190 - item.sourceIndex * 24,
        width: 160,
        height: 14,
        page: 1,
      })),
    },
    question: {
      questionId: 'question-1',
      documentRevision: 7,
      pageRefs: [1],
      choiceCount,
    },
    answerRegion: {
      regionId: 'region-answer',
      questionId: 'question-1',
      documentRevision: 7,
      pageNumber: 1,
      kind: 'answer',
      rect: { coordinateSpace: 'pdf-user-space', ...rect },
    },
  };
}

test('extracts one Korean circled answer without returning source text', () => {
  const input = setup(['문제 본문', '정답: ④ 비공개 텍스트']);
  const result = extractManualAnswerValue(input);
  assert.deepEqual(result, {
    contractVersion: 1,
    questionId: 'question-1',
    documentRevision: 7,
    answerRegionId: 'region-answer',
    status: 'known',
    value: 4,
    reasonCodes: [],
    sourceItemCount: 2,
    candidateCount: 1,
  });
  assert.ok(!JSON.stringify(result).includes('비공개'));
});

test('distinguishes missing, multiple, out-of-range and choice-count mismatch values', () => {
  const cases = [
    {
      input: setup(['정답은 하단 표에 있습니다']),
      status: 'unknown',
      code: 'ANSWER_VALUE_NOT_FOUND',
    },
    {
      input: setup(['정답: ② 또는 ③']),
      status: 'ambiguous',
      code: 'MULTIPLE_ANSWER_VALUES',
    },
    {
      input: setup(['정답: ⑥']),
      status: 'unknown',
      code: 'ANSWER_VALUE_OUT_OF_SUPPORTED_RANGE',
    },
    {
      input: setup(['정답: 5'], { choiceCount: 4 }),
      status: 'unknown',
      code: 'ANSWER_VALUE_EXCEEDS_CHOICE_COUNT',
    },
  ];
  for (const { input, status, code } of cases) {
    const result = extractManualAnswerValue(input);
    assert.equal(result.status, status);
    assert.equal(result.value, null);
    assert.deepEqual(result.reasonCodes, [code]);
  }
});

test('does not guess outside the confirmed answer Region or across stale context', () => {
  const noTextInRect = setup(['정답: ⑤'], {
    rect: { x: 20, y: 20, width: 200, height: 40 },
  });
  const outside = extractManualAnswerValue(noTextInRect);
  assert.equal(outside.status, 'unknown');
  assert.deepEqual(outside.reasonCodes, ['ANSWER_REGION_TEXT_NOT_FOUND']);

  const stale = setup(['정답: ⑤']);
  stale.coordinates.documentRevision = 8;
  assert.deepEqual(extractManualAnswerValue(stale), {
    status: 'error',
    code: 'INVALID_TEXT_COORDINATES',
  });
});
