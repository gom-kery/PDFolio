import { PAGE_ANSWER_REGION_CONTRACT_VERSION } from './page-answer-regions.js';
import { KEYWORD_CANDIDATE_CONTRACT_VERSION } from './page-keyword-candidates.js';
import { TEXT_COORDINATE_CONTRACT_VERSION } from './page-text-coordinates.js';
import { PAGE_TEXT_CONTRACT_VERSION } from '../shared/page-text-contract.js';

export const PAGE_SUPPORT_PROFILE_CONTRACT_VERSION = 1;
export const FIRST_MVP_ANALYSIS_PROFILE_ID =
  'single-page-single-column-two-headings-v1';

const TEXT_REASON_CODES = new Set([
  'NO_TEXT_ITEMS',
  'WHITESPACE_ONLY',
  'TOO_LITTLE_TEXT',
  'LOW_TEXT_QUALITY',
  'INVALID_TEXT_SOURCE',
  'CONFLICTING_SIGNALS',
  'TEXT_EXTRACTION_FAILED',
]);
const REGION_REASON_CODES = new Set([
  'NO_HEADING_CANDIDATES',
  'ROTATED_READING_ORDER_UNVERIFIED',
  'VERTICAL_READING_ORDER_UNVERIFIED',
  'SOURCE_ORDER_GEOMETRY_CONFLICT',
  'POSSIBLE_MULTI_COLUMN_LAYOUT',
  'MULTIPLE_SOLUTION_HEADINGS',
  'MULTIPLE_ANSWER_HEADINGS',
  'MISSING_SOLUTION_HEADING',
  'MISSING_ANSWER_HEADING',
  'NO_PRECEDING_PROBLEM_CONTENT',
  'NON_TEXT_CONTENT_UNVERIFIED',
  'OPEN_ENDED_LAST_REGION',
  'NO_REGION_BODY_AFTER_HEADING',
]);
const PROFILE_BLOCKING_REASON_CODES = new Set([
  'MISSING_SOLUTION_HEADING',
  'MISSING_ANSWER_HEADING',
  'NO_PRECEDING_PROBLEM_CONTENT',
  'NO_REGION_BODY_AFTER_HEADING',
]);
const PROFILE_LIMITATION_CODES = [
  'NON_TEXT_CONTENT_UNVERIFIED',
  'OPEN_ENDED_LAST_REGION',
  'SAFE_MASK_NOT_VERIFIED',
  'QUESTION_OWNERSHIP_NOT_ESTABLISHED',
];

function hasOnlyPublicCodes(codes, allowed) {
  return (
    Array.isArray(codes) &&
    codes.length > 0 &&
    codes.every((code) => typeof code === 'string' && allowed.has(code))
  );
}

function isMatchingAssessment(assessment) {
  if (
    assessment?.contractVersion !== PAGE_TEXT_CONTRACT_VERSION ||
    !Number.isSafeInteger(assessment.documentRevision) ||
    assessment.documentRevision <= 0 ||
    !Number.isSafeInteger(assessment.pageNumber) ||
    assessment.pageNumber <= 0 ||
    !['text-usable', 'text-insufficient', 'unknown'].includes(
      assessment.quality,
    ) ||
    !Array.isArray(assessment.reasonCodes) ||
    typeof assessment.plainText !== 'string'
  ) {
    return false;
  }
  return assessment.quality === 'text-usable'
    ? assessment.reasonCodes.length === 0
    : hasOnlyPublicCodes(assessment.reasonCodes, TEXT_REASON_CODES);
}

function isMatchingKeywordCandidates(assessment, keywords) {
  return (
    keywords?.contractVersion === KEYWORD_CANDIDATE_CONTRACT_VERSION &&
    keywords.sourceContractVersion === PAGE_TEXT_CONTRACT_VERSION &&
    keywords.documentRevision === assessment.documentRevision &&
    keywords.pageNumber === assessment.pageNumber &&
    Number.isSafeInteger(keywords.candidateCount) &&
    keywords.candidateCount >= 0 &&
    Array.isArray(keywords.candidates) &&
    keywords.candidateCount === keywords.candidates.length &&
    keywords.candidates.every(
      (candidate) =>
        ['solution-heading', 'answer-heading'].includes(candidate?.kind) &&
        Number.isSafeInteger(candidate.sourceLineNumber) &&
        candidate.sourceLineNumber > 0 &&
        Array.isArray(candidate.sourceIndexes) &&
        candidate.sourceIndexes.length > 0 &&
        candidate.sourceIndexes.every(
          (sourceIndex) =>
            Number.isSafeInteger(sourceIndex) && sourceIndex >= 0,
        ),
    )
  );
}

function isFinitePageRect(rect, pageNumber) {
  return (
    rect?.page === pageNumber &&
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
    rect.width >= 0 &&
    rect.height >= 0
  );
}

function isMatchingAnswerRegions(assessment, regions) {
  return (
    regions?.contractVersion === PAGE_ANSWER_REGION_CONTRACT_VERSION &&
    regions.sourceContractVersion === PAGE_TEXT_CONTRACT_VERSION &&
    regions.coordinateContractVersion === TEXT_COORDINATE_CONTRACT_VERSION &&
    regions.keywordContractVersion === KEYWORD_CANDIDATE_CONTRACT_VERSION &&
    regions.documentRevision === assessment.documentRevision &&
    regions.pageNumber === assessment.pageNumber &&
    regions.coordinateSpace === 'pdf-user-space' &&
    ['candidate-regions', 'uncertain', 'no-candidates'].includes(
      regions.outcome,
    ) &&
    Number.isSafeInteger(regions.regionCount) &&
    regions.regionCount >= 0 &&
    Array.isArray(regions.reasonCodes) &&
    regions.reasonCodes.every(
      (code) => typeof code === 'string' && REGION_REASON_CODES.has(code),
    ) &&
    Array.isArray(regions.regions) &&
    regions.regionCount === regions.regions.length &&
    regions.regions.every(
      (region) =>
        ['solution-region', 'answer-region'].includes(region?.kind) &&
        region.coordinateSpace === 'pdf-user-space' &&
        region.coverage === 'text-bounds-only' &&
        isFinitePageRect(region.bounds, assessment.pageNumber) &&
        Array.isArray(region.textRects) &&
        region.textRects.length > 0 &&
        region.textRects.every((rect) =>
          isFinitePageRect(rect, assessment.pageNumber),
        ) &&
        Array.isArray(region.reasonCodes) &&
        region.reasonCodes.every(
          (code) => typeof code === 'string' && REGION_REASON_CODES.has(code),
        ),
    )
  );
}

function createResult(
  assessment,
  verdict,
  reasonCodes,
  keywordCandidates = null,
  answerRegions = null,
) {
  return {
    status: 'profile-ready',
    result: {
      contractVersion: PAGE_SUPPORT_PROFILE_CONTRACT_VERSION,
      assessmentContractVersion: PAGE_TEXT_CONTRACT_VERSION,
      keywordContractVersion: KEYWORD_CANDIDATE_CONTRACT_VERSION,
      regionContractVersion: PAGE_ANSWER_REGION_CONTRACT_VERSION,
      documentRevision: assessment.documentRevision,
      pageNumber: assessment.pageNumber,
      profileId: FIRST_MVP_ANALYSIS_PROFILE_ID,
      verdict,
      canStartCbt: false,
      reasonCodes: [...new Set(reasonCodes)],
      evidence: {
        textQuality: assessment.quality,
        keywordCandidateCount: keywordCandidates?.candidateCount ?? 0,
        regionOutcome: answerRegions?.outcome ?? 'not-analyzed',
        sequence: answerRegions?.sequence ?? null,
        regionCount: answerRegions?.regionCount ?? 0,
        regionKinds: (answerRegions?.regions ?? []).map(
          (region) => region.kind,
        ),
      },
    },
  };
}

function expectedKinds(sequence) {
  if (sequence === 'solution-then-answer') {
    return {
      headings: ['solution-heading', 'answer-heading'],
      regions: ['solution-region', 'answer-region'],
    };
  }
  if (sequence === 'answer-then-solution') {
    return {
      headings: ['answer-heading', 'solution-heading'],
      regions: ['answer-region', 'solution-region'],
    };
  }
  return null;
}

/** Classify existing page evidence without creating Questions, Masks or answers. */
export function classifyPageSupportProfile({
  assessment,
  keywordCandidates = null,
  answerRegions = null,
} = {}) {
  if (!isMatchingAssessment(assessment)) {
    return { status: 'error', code: 'INVALID_PAGE_TEXT_ASSESSMENT' };
  }
  if (assessment.quality !== 'text-usable') {
    return createResult(assessment, 'hold', [
      'TEXT_NOT_USABLE',
      ...assessment.reasonCodes,
    ]);
  }
  if (!isMatchingKeywordCandidates(assessment, keywordCandidates)) {
    return { status: 'error', code: 'INVALID_KEYWORD_CANDIDATES' };
  }
  if (!isMatchingAnswerRegions(assessment, answerRegions)) {
    return { status: 'error', code: 'INVALID_ANSWER_REGIONS' };
  }

  if (answerRegions.outcome === 'uncertain') {
    return createResult(
      assessment,
      'hold',
      answerRegions.reasonCodes,
      keywordCandidates,
      answerRegions,
    );
  }
  if (answerRegions.outcome === 'no-candidates') {
    return createResult(
      assessment,
      'not-supported',
      answerRegions.reasonCodes,
      keywordCandidates,
      answerRegions,
    );
  }

  const kinds = expectedKinds(answerRegions.sequence);
  const headingKinds = keywordCandidates.candidates.map(
    (candidate) => candidate.kind,
  );
  const regionKinds = answerRegions.regions.map((region) => region.kind);
  const hasExpectedEvidence =
    kinds &&
    keywordCandidates.candidateCount === 2 &&
    answerRegions.regionCount === 2 &&
    headingKinds.every((kind, index) => kind === kinds.headings[index]) &&
    regionKinds.every((kind, index) => kind === kinds.regions[index]);
  const blockingReasons = answerRegions.reasonCodes.filter((reason) =>
    PROFILE_BLOCKING_REASON_CODES.has(reason),
  );
  if (!hasExpectedEvidence || blockingReasons.length > 0) {
    return createResult(
      assessment,
      'not-supported',
      [
        ...(hasExpectedEvidence ? [] : ['PROFILE_REQUIRES_BOTH_HEADINGS']),
        ...blockingReasons,
      ],
      keywordCandidates,
      answerRegions,
    );
  }

  return createResult(
    assessment,
    'profile-match',
    PROFILE_LIMITATION_CODES,
    keywordCandidates,
    answerRegions,
  );
}
