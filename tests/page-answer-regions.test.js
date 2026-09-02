import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inferPageAnswerRegions } from '../src/analysis/page-answer-regions.js';
import { findPageKeywordCandidates } from '../src/analysis/page-keyword-candidates.js';
import { assessPageText } from '../src/analysis/page-text-assessment.js';
import { createPageTextCoordinates } from '../src/analysis/page-text-coordinates.js';

function sourceFromLines(lines, { rotation = 0, positions } = {}) {
  const items = lines.map((sourceText, sourceIndex) => ({
    sourceIndex,
    sourceText,
    direction: 'ltr',
    transform: [
      10,
      0,
      0,
      10,
      positions?.[sourceIndex]?.x ?? 20,
      positions?.[sourceIndex]?.y ?? 280 - sourceIndex * 30,
    ],
    width: Math.max(1, sourceText.length * 6),
    height: 10,
    fontName: 'font-1',
    hasEOL: true,
  }));
  return {
    contractVersion: 1,
    documentRevision: 11,
    pageNumber: 1,
    pageCount: 1,
    language: null,
    page: { viewBox: [0, 0, 400, 320], userUnit: 1, rotation },
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

function infer(source) {
  const assessment = assessPageText(source);
  const coordinates = createPageTextCoordinates(source);
  const keywords = findPageKeywordCandidates({ source, assessment });
  assert.equal(coordinates.status, 'coordinates-ready');
  assert.equal(keywords.status, 'candidates-ready');
  return inferPageAnswerRegions({
    source,
    assessment,
    coordinates: coordinates.coordinates,
    keywordCandidates: keywords.result,
  });
}

test('infers solution then answer regions without including problem lines', () => {
  const result = infer(
    sourceFromLines([
      '1. 다음 중 옳은 내용을 고르시오.',
      '① 첫 번째 보기 ② 두 번째 보기',
      '해설: 계산 과정을 시작합니다.',
      '계산을 계속하여 결과를 확인합니다.',
      '정답: ②',
    ]),
  );
  assert.equal(result.status, 'regions-ready');
  assert.equal(result.result.outcome, 'candidate-regions');
  assert.equal(result.result.sequence, 'solution-then-answer');
  assert.equal(result.result.regionCount, 2);
  assert.deepEqual(result.result.regions[0].sourceLineRange, {
    start: 3,
    end: 4,
  });
  assert.deepEqual(result.result.regions[0].endBoundary, {
    type: 'before-next-heading',
    sourceLineNumber: 5,
  });
  assert.deepEqual(result.result.regions[0].sourceIndexes, [2, 3]);
  assert.ok(!result.result.regions[0].sourceIndexes.includes(0));
  assert.equal(result.result.regions[1].kind, 'answer-region');
});

test('accepts the answer then solution order as a separate sequence', () => {
  const result = infer(
    sourceFromLines([
      '2. 문제 본문과 보기 내용입니다.',
      'Answer: C',
      'Solution: apply the stated rule.',
      'Continue the explanation to its conclusion.',
    ]),
  );
  assert.equal(result.result.sequence, 'answer-then-solution');
  assert.deepEqual(
    result.result.regions.map((region) => region.kind),
    ['answer-region', 'solution-region'],
  );
});

test('keeps text-only and open-ended limitations on every inferred page', () => {
  const result = infer(
    sourceFromLines([
      '문제 본문은 영역 앞에 남아 있습니다.',
      '풀이: 그림이 포함될 수도 있는 설명입니다.',
      '정답: A',
    ]),
  );
  assert.ok(result.result.reasonCodes.includes('NON_TEXT_CONTENT_UNVERIFIED'));
  assert.ok(result.result.reasonCodes.includes('OPEN_ENDED_LAST_REGION'));
  assert.equal(result.result.regions[0].coverage, 'text-bounds-only');
  assert.equal(result.result.regions[0].coordinateSpace, 'pdf-user-space');
  assert.ok(result.result.regions[0].textRects.length > 0);
});

test('keeps a single solution candidate but records the missing answer', () => {
  const result = infer(
    sourceFromLines([
      '문제와 보기에 해당하는 충분한 본문입니다.',
      'Explanation: only a solution heading is present.',
      'The explanation continues on this line.',
    ]),
  );
  assert.equal(result.result.sequence, 'single-solution');
  assert.equal(result.result.regionCount, 1);
  assert.ok(result.result.reasonCodes.includes('MISSING_ANSWER_HEADING'));
});

test('returns no candidates when the usable page has no heading keyword', () => {
  const result = infer(
    sourceFromLines(['문제 본문과 보기만 충분히 들어 있는 페이지입니다.']),
  );
  assert.equal(result.result.outcome, 'no-candidates');
  assert.equal(result.result.regionCount, 0);
  assert.deepEqual(result.result.reasonCodes, ['NO_HEADING_CANDIDATES']);
});

test('holds duplicate heading kinds instead of guessing multiple questions', () => {
  const result = infer(
    sourceFromLines([
      '문제 본문과 보기 내용이 충분히 있습니다.',
      '해설: 첫 번째 설명입니다.',
      '해설: 두 번째 설명입니다.',
      '정답: ③',
    ]),
  );
  assert.equal(result.result.outcome, 'uncertain');
  assert.equal(result.result.regionCount, 0);
  assert.deepEqual(result.result.reasonCodes, ['MULTIPLE_SOLUTION_HEADINGS']);
});

test('holds source-order geometry conflicts and possible columns', () => {
  const reversed = infer(
    sourceFromLines(
      ['문제 본문이 충분히 있습니다.', '해설: 설명입니다.', '정답: ①'],
      { positions: [{ y: 250 }, { y: 280 }, { y: 220 }] },
    ),
  );
  assert.equal(reversed.result.outcome, 'uncertain');
  assert.ok(
    reversed.result.reasonCodes.includes('SOURCE_ORDER_GEOMETRY_CONFLICT'),
  );

  const columns = infer(
    sourceFromLines(
      ['문제 본문이 충분히 있습니다.', '해설: 왼쪽 열', '정답: 오른쪽 열'],
      {
        positions: [
          { x: 20, y: 280 },
          { x: 20, y: 220 },
          { x: 250, y: 220 },
        ],
      },
    ),
  );
  assert.equal(columns.result.outcome, 'uncertain');
  assert.ok(
    columns.result.reasonCodes.includes('POSSIBLE_MULTI_COLUMN_LAYOUT'),
  );
});

test('holds rotated and vertical reading order until visual validation', () => {
  const rotated = infer(
    sourceFromLines(
      ['문제 본문이 충분히 있습니다.', '해설: 설명입니다.', '정답: ①'],
      { rotation: 90 },
    ),
  );
  assert.equal(rotated.result.outcome, 'uncertain');
  assert.ok(
    rotated.result.reasonCodes.includes('ROTATED_READING_ORDER_UNVERIFIED'),
  );

  const verticalSource = sourceFromLines([
    '문제 본문이 충분히 있습니다.',
    '해설: 설명입니다.',
    '정답: ①',
  ]);
  verticalSource.items[1].direction = 'ttb';
  const vertical = infer(verticalSource);
  assert.ok(
    vertical.result.reasonCodes.includes('VERTICAL_READING_ORDER_UNVERIFIED'),
  );
});

test('skips unusable text and rejects mismatched evidence without private text', () => {
  const source = sourceFromLines(['1']);
  const assessment = assessPageText(source);
  const skipped = inferPageAnswerRegions({ source, assessment });
  assert.equal(skipped.status, 'skipped');
  assert.equal(skipped.code, 'TEXT_NOT_USABLE');

  const usable = sourceFromLines([
    '문제 본문과 보기가 충분히 들어 있습니다.',
    '정답: ②',
  ]);
  const usableAssessment = assessPageText(usable);
  const coordinates = createPageTextCoordinates(usable).coordinates;
  const keywords = findPageKeywordCandidates({
    source: usable,
    assessment: usableAssessment,
  }).result;
  const mismatch = inferPageAnswerRegions({
    source: usable,
    assessment: usableAssessment,
    coordinates: { ...coordinates, pageNumber: 2 },
    keywordCandidates: keywords,
  });
  assert.deepEqual(mismatch, {
    status: 'error',
    code: 'INVALID_TEXT_COORDINATES',
  });
  assert.ok(!JSON.stringify(mismatch).includes('문제 본문'));
  assert.deepEqual(inferPageAnswerRegions({ source: {} }), {
    status: 'error',
    code: 'INVALID_TEXT_SOURCE',
  });
});

test('region results contain geometry evidence but no surrounding source text', () => {
  const secret = '공개 결과에 들어가면 안 되는 설명 원문';
  const result = infer(
    sourceFromLines([
      '문제 본문과 보기가 충분히 들어 있습니다.',
      `해설: ${secret}`,
      '정답: ④',
    ]),
  );
  const serialized = JSON.stringify(result.result);
  assert.ok(!serialized.includes(secret));
  assert.ok(!Object.hasOwn(result.result.regions[0], 'text'));
  assert.ok(!Object.hasOwn(result.result.regions[0], 'questionId'));
  assert.ok(!Object.hasOwn(result.result.regions[0], 'mask'));
});
