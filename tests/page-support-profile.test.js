import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inferPageAnswerRegions } from '../src/analysis/page-answer-regions.js';
import { findPageKeywordCandidates } from '../src/analysis/page-keyword-candidates.js';
import {
  classifyPageSupportProfile,
  FIRST_MVP_ANALYSIS_PROFILE_ID,
} from '../src/analysis/page-support-profile.js';
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
    documentRevision: 12,
    pageNumber: 1,
    pageCount: 1,
    language: null,
    page: { viewBox: [0, 0, 400, 320], userUnit: 1, rotation },
    items,
    styles: items.length
      ? [
          {
            fontName: 'font-1',
            ascent: 0.8,
            descent: -0.2,
            vertical: false,
            fontFamily: 'sans-serif',
          },
        ]
      : [],
  };
}

function analyze(source) {
  const assessment = assessPageText(source);
  if (assessment.quality !== 'text-usable') {
    return {
      assessment,
      profile: classifyPageSupportProfile({ assessment }),
      regions: null,
    };
  }
  const coordinates = createPageTextCoordinates(source).coordinates;
  const keywords = findPageKeywordCandidates({ source, assessment }).result;
  const regions = inferPageAnswerRegions({
    source,
    assessment,
    coordinates,
    keywordCandidates: keywords,
  }).result;
  return {
    assessment,
    keywords,
    regions,
    profile: classifyPageSupportProfile({
      assessment,
      keywordCandidates: keywords,
      answerRegions: regions,
    }),
  };
}

test('matches both approved A/B analysis orders but never starts CBT', () => {
  for (const [lines, sequence] of [
    [
      [
        '1. 문제 본문과 보기 내용이 충분히 있습니다.',
        '① 첫 번째 보기 ② 두 번째 보기',
        '해설: 계산 과정을 시작합니다.',
        '계산을 계속하여 결과를 확인합니다.',
        '정답: ②',
      ],
      'solution-then-answer',
    ],
    [
      [
        '2. 문제 본문과 보기 내용이 충분히 있습니다.',
        'Answer: C',
        'Solution: apply the stated rule.',
        'Continue the explanation to its conclusion.',
      ],
      'answer-then-solution',
    ],
  ]) {
    const result = analyze(sourceFromLines(lines)).profile;
    assert.equal(result.status, 'profile-ready');
    assert.equal(result.result.profileId, FIRST_MVP_ANALYSIS_PROFILE_ID);
    assert.equal(result.result.verdict, 'profile-match');
    assert.equal(result.result.evidence.sequence, sequence);
    assert.equal(result.result.evidence.regionCount, 2);
    assert.equal(result.result.canStartCbt, false);
    assert.deepEqual(result.result.reasonCodes, [
      'NON_TEXT_CONTENT_UNVERIFIED',
      'OPEN_ENDED_LAST_REGION',
      'SAFE_MASK_NOT_VERIFIED',
      'QUESTION_OWNERSHIP_NOT_ESTABLISHED',
    ]);
  }
});

test('rejects missing headings and holds ambiguous layouts or text', () => {
  const noHeading = analyze(
    sourceFromLines(['문제 본문과 보기만 충분히 들어 있는 페이지입니다.']),
  ).profile.result;
  assert.equal(noHeading.verdict, 'not-supported');
  assert.deepEqual(noHeading.reasonCodes, ['NO_HEADING_CANDIDATES']);

  const oneHeading = analyze(
    sourceFromLines([
      '문제 본문과 보기 내용이 충분히 있습니다.',
      '해설: 설명만 있고 정답 제목은 없습니다.',
    ]),
  ).profile.result;
  assert.equal(oneHeading.verdict, 'not-supported');
  assert.ok(oneHeading.reasonCodes.includes('PROFILE_REQUIRES_BOTH_HEADINGS'));
  assert.ok(oneHeading.reasonCodes.includes('MISSING_ANSWER_HEADING'));

  const duplicates = analyze(
    sourceFromLines([
      '문제 본문과 보기 내용이 충분히 있습니다.',
      '해설: 첫 번째 설명입니다.',
      '해설: 두 번째 설명입니다.',
      '정답: ③',
    ]),
  ).profile.result;
  assert.equal(duplicates.verdict, 'hold');
  assert.ok(duplicates.reasonCodes.includes('MULTIPLE_SOLUTION_HEADINGS'));

  const columns = analyze(
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
  ).profile.result;
  assert.equal(columns.verdict, 'hold');
  assert.ok(columns.reasonCodes.includes('POSSIBLE_MULTI_COLUMN_LAYOUT'));

  const rotated = analyze(
    sourceFromLines(
      ['문제 본문이 충분히 있습니다.', '해설: 설명입니다.', '정답: ①'],
      { rotation: 90 },
    ),
  ).profile.result;
  assert.equal(rotated.verdict, 'hold');
  assert.ok(rotated.reasonCodes.includes('ROTATED_READING_ORDER_UNVERIFIED'));

  const lowText = analyze(sourceFromLines(['1'])).profile.result;
  assert.equal(lowText.verdict, 'hold');
  assert.deepEqual(lowText.reasonCodes, ['TEXT_NOT_USABLE', 'TOO_LITTLE_TEXT']);
});

test('fixed profile matrix has no text misses, problem intrusion or false approval', () => {
  const supported = [
    {
      source: sourceFromLines([
        '1. 문제 본문과 보기 내용이 충분히 있습니다.',
        '① 첫 번째 보기 ② 두 번째 보기',
        '해설: 계산 과정을 시작합니다.',
        '계산을 계속하여 결과를 확인합니다.',
        '정답: ②',
      ]),
      protectedIndexes: [2, 3, 4],
      problemIndexes: [0, 1],
    },
    {
      source: sourceFromLines([
        '2. 문제 본문과 보기 내용이 충분히 있습니다.',
        'Answer: C',
        'Solution: apply the stated rule.',
        'Continue the explanation to its conclusion.',
      ]),
      protectedIndexes: [1, 2, 3],
      problemIndexes: [0],
    },
  ];
  let missedProtectedItems = 0;
  let problemIntrusions = 0;
  for (const sample of supported) {
    const analysis = analyze(sample.source);
    assert.equal(analysis.profile.result.verdict, 'profile-match');
    const covered = new Set(
      analysis.regions.regions.flatMap((region) => region.sourceIndexes),
    );
    missedProtectedItems += sample.protectedIndexes.filter(
      (index) => !covered.has(index),
    ).length;
    problemIntrusions += sample.problemIndexes.filter((index) =>
      covered.has(index),
    ).length;
  }

  const unsupported = [
    sourceFromLines(['문제 본문과 보기만 충분히 들어 있는 페이지입니다.']),
    sourceFromLines([
      '문제 본문과 보기 내용이 충분히 있습니다.',
      '해설: 설명만 있습니다.',
    ]),
    sourceFromLines([
      '문제 본문과 보기 내용이 충분히 있습니다.',
      '해설: 첫 번째 설명입니다.',
      '해설: 두 번째 설명입니다.',
      '정답: ③',
    ]),
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
    sourceFromLines(
      ['문제 본문이 충분히 있습니다.', '해설: 설명입니다.', '정답: ①'],
      { rotation: 90 },
    ),
    sourceFromLines(['1']),
  ];
  const verdicts = unsupported.map(
    (source) => analyze(source).profile.result.verdict,
  );
  assert.equal(missedProtectedItems, 0);
  assert.equal(problemIntrusions, 0);
  assert.equal(
    verdicts.filter((verdict) => verdict === 'profile-match').length,
    0,
  );
  assert.equal(verdicts.filter((verdict) => verdict === 'hold').length, 4);
});

test('rejects mismatched evidence without copying source text', () => {
  const analysis = analyze(
    sourceFromLines([
      'Private question text must never enter public profile output.',
      'Solution: private explanation.',
      'Answer: B',
    ]),
  );
  const mismatch = classifyPageSupportProfile({
    assessment: analysis.assessment,
    keywordCandidates: analysis.keywords,
    answerRegions: { ...analysis.regions, pageNumber: 2 },
  });
  assert.deepEqual(mismatch, {
    status: 'error',
    code: 'INVALID_ANSWER_REGIONS',
  });
  assert.deepEqual(classifyPageSupportProfile({}), {
    status: 'error',
    code: 'INVALID_PAGE_TEXT_ASSESSMENT',
  });
  assert.ok(!JSON.stringify(analysis.profile.result).includes('Private'));
  assert.ok(!Object.hasOwn(analysis.profile.result, 'plainText'));
  assert.ok(!Object.hasOwn(analysis.profile.result, 'coordinates'));
});
