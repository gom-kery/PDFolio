import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessPageText } from '../src/analysis/page-text-assessment.js';
import { createPageTextCoordinates } from '../src/analysis/page-text-coordinates.js';
import { findPageKeywordCandidates } from '../src/analysis/page-keyword-candidates.js';
import { inferPageQuestionCandidates } from '../src/analysis/page-question-candidates.js';

function sourceFromLines(lines, { positions, rotation = 0 } = {}) {
  return {
    contractVersion: 1,
    documentRevision: 21,
    pageNumber: 1,
    pageCount: 1,
    language: null,
    page: { viewBox: [0, 0, 400, 360], userUnit: 1, rotation },
    items: lines.map((sourceText, sourceIndex) => ({
      sourceIndex,
      sourceText,
      direction: 'ltr',
      transform: [
        10,
        0,
        0,
        10,
        positions?.[sourceIndex]?.x ?? 20,
        positions?.[sourceIndex]?.y ?? 330 - sourceIndex * 32,
      ],
      width: Math.max(1, sourceText.length * 6),
      height: 10,
      fontName: 'font-1',
      hasEOL: true,
    })),
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

function infer(source) {
  const assessment = assessPageText(source);
  const coordinates = createPageTextCoordinates(source);
  const keywordCandidates = findPageKeywordCandidates({ source, assessment });
  assert.equal(assessment.quality, 'text-usable');
  assert.equal(coordinates.status, 'coordinates-ready');
  assert.equal(keywordCandidates.status, 'candidates-ready');
  return inferPageQuestionCandidates({
    source,
    assessment,
    coordinates: coordinates.coordinates,
    keywordCandidates: keywordCandidates.result,
  });
}

test('creates draft-only candidates for two single-column questions and maps choices and answer headings', () => {
  const result = infer(
    sourceFromLines([
      '01.',
      '첫 번째 문제의 조건을 확인하고 답을 고르시오.',
      '① 첫째 ② 둘째 ③ 셋째 ④ 넷째',
      '정답: ④',
      '02.',
      '두 번째 문제의 조건을 확인하고 답을 고르시오.',
      '① 첫째 ② 둘째 ③ 셋째 ④ 넷째 ⑤ 다섯째',
      '정답: ②',
    ]),
  );

  assert.equal(result.status, 'question-candidates-ready');
  assert.equal(result.result.outcome, 'candidate-questions');
  assert.equal(result.result.candidateCount, 2);
  assert.equal(result.result.draftCount, 2);
  assert.equal(result.result.holdCount, 0);
  assert.deepEqual(
    result.result.candidates.map((candidate) => ({
      printedQuestionNumber: candidate.printedQuestionNumber,
      columnIndex: candidate.columnIndex,
      columnCount: candidate.columnCount,
      choiceCount: candidate.choiceCount,
      answerHeadingSourceIndexes: candidate.answerHeadingSourceIndexes,
      status: candidate.status,
    })),
    [
      {
        printedQuestionNumber: '01',
        columnIndex: 1,
        columnCount: 1,
        choiceCount: 4,
        answerHeadingSourceIndexes: [3],
        status: 'draft',
      },
      {
        printedQuestionNumber: '02',
        columnIndex: 1,
        columnCount: 1,
        choiceCount: 5,
        answerHeadingSourceIndexes: [7],
        status: 'draft',
      },
    ],
  );
});

test('separates left and right columns without assigning either answer heading to the other question', () => {
  const result = infer(
    sourceFromLines(
      [
        '03.',
        '왼쪽 열 문제의 조건을 확인하고 답을 고르시오.',
        '① 첫째 ② 둘째 ③ 셋째 ④ 넷째',
        '정답: ①',
        '04.',
        '오른쪽 열 문제의 조건을 확인하고 답을 고르시오.',
        '① 첫째 ② 둘째 ③ 셋째 ④ 넷째 ⑤ 다섯째',
        '정답: ⑤',
      ],
      {
        positions: [
          { x: 20, y: 330 },
          { x: 20, y: 298 },
          { x: 20, y: 266 },
          { x: 20, y: 234 },
          { x: 235, y: 330 },
          { x: 235, y: 298 },
          { x: 235, y: 266 },
          { x: 235, y: 234 },
        ],
      },
    ),
  );

  assert.equal(result.result.outcome, 'candidate-questions');
  assert.deepEqual(
    result.result.candidates.map((candidate) => ({
      printedQuestionNumber: candidate.printedQuestionNumber,
      columnIndex: candidate.columnIndex,
      columnCount: candidate.columnCount,
      choiceCount: candidate.choiceCount,
      answerHeadingSourceIndexes: candidate.answerHeadingSourceIndexes,
      status: candidate.status,
    })),
    [
      {
        printedQuestionNumber: '03',
        columnIndex: 1,
        columnCount: 2,
        choiceCount: 4,
        answerHeadingSourceIndexes: [3],
        status: 'draft',
      },
      {
        printedQuestionNumber: '04',
        columnIndex: 2,
        columnCount: 2,
        choiceCount: 5,
        answerHeadingSourceIndexes: [7],
        status: 'draft',
      },
    ],
  );
});

test('does not mistake line-by-line numeric choices for additional question starts', () => {
  const result = infer(
    sourceFromLines([
      'Question 1.',
      '첫 번째 문제의 조건을 확인하고 답을 고르시오.',
      '1. 첫째',
      '2. 둘째',
      '3. 셋째',
      '4. 넷째',
      '정답: ④',
      'Question 2.',
      '두 번째 문제의 조건을 확인하고 답을 고르시오.',
      '1. 첫째',
      '2. 둘째',
      '3. 셋째',
      '4. 넷째',
      '5. 다섯째',
      '정답: ⑤',
    ]),
  );

  assert.equal(result.result.outcome, 'candidate-questions');
  assert.deepEqual(
    result.result.candidates.map((candidate) => candidate.choiceCount),
    [4, 5],
  );
});

test('holds duplicate labels, missing choices, and multiple answer headings instead of creating usable candidates', () => {
  const result = infer(
    sourceFromLines([
      '01.',
      '첫 번째 문제의 충분한 본문입니다.',
      '① 첫째 ② 둘째 ③ 셋째 ④ 넷째',
      '정답: ①',
      '01.',
      '두 번째 문제의 충분한 본문입니다.',
      '① 첫째 ② 둘째 ③ 셋째',
      '정답: ②',
      '답: ③',
    ]),
  );

  assert.equal(result.result.outcome, 'uncertain');
  assert.equal(result.result.draftCount, 0);
  assert.equal(result.result.holdCount, 2);
  assert.ok(
    result.result.candidates.every((candidate) =>
      candidate.reasonCodes.includes('DUPLICATE_PRINTED_QUESTION_NUMBER'),
    ),
  );
  assert.ok(
    result.result.candidates[1].reasonCodes.includes('CHOICE_COUNT_UNVERIFIED'),
  );
  assert.ok(
    result.result.candidates[1].reasonCodes.includes(
      'MULTIPLE_ANSWER_HEADINGS',
    ),
  );
});

test('does not turn one page-single question into a Unit 4.2 candidate', () => {
  const result = infer(
    sourceFromLines([
      '01.',
      '한 문제만 있는 페이지의 충분한 본문입니다.',
      '① 첫째 ② 둘째 ③ 셋째 ④ 넷째',
      '정답: ④',
    ]),
  );

  assert.deepEqual(result.result, {
    contractVersion: 1,
    sourceContractVersion: 1,
    coordinateContractVersion: 1,
    keywordContractVersion: 1,
    documentRevision: 21,
    pageNumber: 1,
    outcome: 'no-candidates',
    candidateCount: 0,
    draftCount: 0,
    holdCount: 0,
    candidates: [],
    reasonCodes: ['NOT_MULTI_QUESTION_PAGE'],
  });
});

test('holds rotated or vertical text and rejects stale inputs without returning source text', () => {
  const rotatedSource = sourceFromLines(
    [
      '01.',
      '첫 번째 문제의 충분한 본문입니다.',
      '① 첫째 ② 둘째 ③ 셋째 ④ 넷째',
      '정답: ①',
      '02.',
      '두 번째 문제의 충분한 본문입니다.',
      '① 첫째 ② 둘째 ③ 셋째 ④ 넷째',
      '정답: ②',
    ],
    { rotation: 90 },
  );
  const rotated = infer(rotatedSource);
  assert.deepEqual(rotated.result.reasonCodes, [
    'ROTATED_READING_ORDER_UNVERIFIED',
  ]);

  const source = sourceFromLines([
    '01.',
    '첫 번째 문제의 충분한 본문입니다.',
    '① 첫째 ② 둘째 ③ 셋째 ④ 넷째',
    '정답: ①',
    '02.',
    '두 번째 문제의 충분한 본문입니다.',
    '① 첫째 ② 둘째 ③ 셋째 ④ 넷째',
    '정답: ②',
  ]);
  const assessment = assessPageText(source);
  const coordinates = createPageTextCoordinates(source).coordinates;
  const keywordCandidates = findPageKeywordCandidates({
    source,
    assessment,
  }).result;
  const stale = inferPageQuestionCandidates({
    source,
    assessment,
    coordinates: { ...coordinates, pageNumber: 2 },
    keywordCandidates,
  });
  assert.deepEqual(stale, {
    status: 'error',
    code: 'INVALID_TEXT_COORDINATES',
  });
  assert.ok(!JSON.stringify(stale).includes('첫 번째 문제'));
});

test('candidate evidence has no raw question, choice, or answer text', () => {
  const secret = '외부에 노출되면 안 되는 문제 원문';
  const result = infer(
    sourceFromLines([
      '01.',
      secret,
      '① 첫째 ② 둘째 ③ 셋째 ④ 넷째',
      '정답: ①',
      '02.',
      '두 번째 문제의 충분한 본문입니다.',
      '① 첫째 ② 둘째 ③ 셋째 ④ 넷째',
      '정답: ②',
    ]),
  );
  const serialized = JSON.stringify(result.result);
  assert.ok(!serialized.includes(secret));
  assert.ok(!Object.hasOwn(result.result.candidates[0], 'text'));
  assert.ok(!Object.hasOwn(result.result.candidates[0], 'answerValue'));
  assert.ok(!Object.hasOwn(result.result.candidates[0], 'questionId'));
});
