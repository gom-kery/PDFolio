import { KEYWORD_CANDIDATE_CONTRACT_VERSION } from './page-keyword-candidates.js';
import { TEXT_COORDINATE_CONTRACT_VERSION } from './page-text-coordinates.js';
import {
  isPageTextSource,
  PAGE_TEXT_CONTRACT_VERSION,
} from '../shared/page-text-contract.js';

export const PAGE_ANSWER_REGION_CONTRACT_VERSION = 1;

const LINE_ORDER_TOLERANCE = 2;
const MIN_COLUMN_GAP_PAGE_RATIO = 0.08;

function hasMatchingAssessment(source, assessment) {
  return (
    assessment &&
    assessment.contractVersion === PAGE_TEXT_CONTRACT_VERSION &&
    assessment.documentRevision === source.documentRevision &&
    assessment.pageNumber === source.pageNumber &&
    ['text-usable', 'text-insufficient', 'unknown'].includes(
      assessment.quality,
    ) &&
    Array.isArray(assessment.reasonCodes)
  );
}

function sameNumbers(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function hasMatchingCoordinates(source, coordinates) {
  return (
    coordinates &&
    coordinates.contractVersion === TEXT_COORDINATE_CONTRACT_VERSION &&
    coordinates.sourceContractVersion === PAGE_TEXT_CONTRACT_VERSION &&
    coordinates.documentRevision === source.documentRevision &&
    coordinates.pageNumber === source.pageNumber &&
    coordinates.coordinateSpace === 'pdf-user-space' &&
    sameNumbers(coordinates.page?.viewBox, source.page.viewBox) &&
    coordinates.page.userUnit === source.page.userUnit &&
    coordinates.page.rotation === ((source.page.rotation % 360) + 360) % 360 &&
    Array.isArray(coordinates.items) &&
    coordinates.items.length === source.items.length &&
    coordinates.items.every((item, index) => {
      const sourceItem = source.items[index];
      return (
        item?.sourceIndex === sourceItem.sourceIndex &&
        item.text === sourceItem.sourceText &&
        item.page === source.pageNumber &&
        [item.x, item.y, item.width, item.height].every(Number.isFinite) &&
        item.width >= 0 &&
        item.height > 0
      );
    })
  );
}

function createSourceLines(items) {
  const lines = [];
  let sourceIndexes = [];
  const flush = () => {
    if (sourceIndexes.length === 0) return;
    lines.push({
      sourceLineNumber: lines.length + 1,
      sourceIndexes,
    });
    sourceIndexes = [];
  };

  for (const item of items) {
    sourceIndexes.push(item.sourceIndex);
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}

function hasMatchingKeywordCandidates(source, keywordCandidates, lines) {
  if (
    !keywordCandidates ||
    keywordCandidates.contractVersion !== KEYWORD_CANDIDATE_CONTRACT_VERSION ||
    keywordCandidates.sourceContractVersion !== PAGE_TEXT_CONTRACT_VERSION ||
    keywordCandidates.documentRevision !== source.documentRevision ||
    keywordCandidates.pageNumber !== source.pageNumber ||
    !Number.isSafeInteger(keywordCandidates.candidateCount) ||
    keywordCandidates.candidateCount < 0 ||
    !Array.isArray(keywordCandidates.candidates) ||
    keywordCandidates.candidateCount !== keywordCandidates.candidates.length
  ) {
    return false;
  }

  const candidateLines = new Set();
  return keywordCandidates.candidates.every((candidate) => {
    if (
      !Number.isSafeInteger(candidate?.sourceLineNumber) ||
      candidate.sourceLineNumber < 1 ||
      candidateLines.has(candidate.sourceLineNumber)
    )
      return false;
    candidateLines.add(candidate.sourceLineNumber);
    const line = lines[candidate?.sourceLineNumber - 1];
    return (
      ['solution-heading', 'answer-heading'].includes(candidate?.kind) &&
      typeof candidate.canonicalKeyword === 'string' &&
      typeof candidate.matchedText === 'string' &&
      ['ko', 'en'].includes(candidate.language) &&
      [
        'standalone-heading',
        'heading-with-delimiter',
        'heading-with-content',
        'heading-with-answer',
      ].includes(candidate.context) &&
      ['single-item', 'fragmented-items'].includes(candidate.matchMode) &&
      Array.isArray(candidate.sourceIndexes) &&
      candidate.sourceIndexes.length > 0 &&
      line &&
      candidate.sourceIndexes.every((sourceIndex) =>
        line.sourceIndexes.includes(sourceIndex),
      )
    );
  });
}

function unionRects(rects, pageNumber) {
  const x = Math.min(...rects.map((rect) => rect.x));
  const y = Math.min(...rects.map((rect) => rect.y));
  const xMax = Math.max(...rects.map((rect) => rect.x + rect.width));
  const yMax = Math.max(...rects.map((rect) => rect.y + rect.height));
  return {
    x,
    y,
    width: xMax - x,
    height: yMax - y,
    page: pageNumber,
  };
}

function createGeometryLines(lines, coordinates) {
  const coordinateByIndex = new Map(
    coordinates.items.map((item) => [item.sourceIndex, item]),
  );
  return lines.map((line) => {
    const items = line.sourceIndexes.map((index) =>
      coordinateByIndex.get(index),
    );
    const bounds = unionRects(items, coordinates.pageNumber);
    return {
      ...line,
      bounds,
      centerY: bounds.y + bounds.height / 2,
    };
  });
}

function verticalOverlap(left, right) {
  return Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) -
      Math.max(left.y, right.y),
  );
}

function horizontalGap(left, right) {
  if (left.x + left.width <= right.x) return right.x - (left.x + left.width);
  if (right.x + right.width <= left.x) return left.x - (right.x + right.width);
  return 0;
}

function findGeometryReasonCodes(source, lines) {
  const reasons = [];
  const rotation = ((source.page.rotation % 360) + 360) % 360;
  if (rotation !== 0) reasons.push('ROTATED_READING_ORDER_UNVERIFIED');
  if (source.items.some((item) => item.direction === 'ttb'))
    reasons.push('VERTICAL_READING_ORDER_UNVERIFIED');

  for (let index = 1; index < lines.length; index++) {
    const previous = lines[index - 1];
    const current = lines[index];
    if (
      verticalOverlap(previous.bounds, current.bounds) === 0 &&
      current.centerY > previous.centerY + LINE_ORDER_TOLERANCE
    ) {
      reasons.push('SOURCE_ORDER_GEOMETRY_CONFLICT');
      break;
    }
  }

  const pageWidth = source.page.viewBox[2] - source.page.viewBox[0];
  const minimumColumnGap = pageWidth * MIN_COLUMN_GAP_PAGE_RATIO;
  outer: for (let leftIndex = 0; leftIndex < lines.length; leftIndex++) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < lines.length;
      rightIndex++
    ) {
      const left = lines[leftIndex].bounds;
      const right = lines[rightIndex].bounds;
      if (
        verticalOverlap(left, right) >=
          Math.min(left.height, right.height) / 2 &&
        horizontalGap(left, right) >= minimumColumnGap
      ) {
        reasons.push('POSSIBLE_MULTI_COLUMN_LAYOUT');
        break outer;
      }
    }
  }
  return [...new Set(reasons)];
}

function sequenceFor(candidates) {
  if (candidates.length === 1)
    return candidates[0].kind === 'solution-heading'
      ? 'single-solution'
      : 'single-answer';
  return candidates[0].kind === 'solution-heading'
    ? 'solution-then-answer'
    : 'answer-then-solution';
}

function createRegion(candidate, nextCandidate, lines, pageNumber, index) {
  const startLineIndex = candidate.sourceLineNumber - 1;
  const endLineIndex = nextCandidate
    ? nextCandidate.sourceLineNumber - 2
    : lines.length - 1;
  const regionLines = lines.slice(startLineIndex, endLineIndex + 1);
  const textRects = regionLines.map((line) => ({ ...line.bounds }));
  const reasonCodes = ['NON_TEXT_CONTENT_UNVERIFIED'];
  if (!nextCandidate) reasonCodes.push('OPEN_ENDED_LAST_REGION');
  if (regionLines.length === 1 && candidate.context === 'standalone-heading')
    reasonCodes.push('NO_REGION_BODY_AFTER_HEADING');
  return {
    candidateIndex: index,
    kind:
      candidate.kind === 'solution-heading'
        ? 'solution-region'
        : 'answer-region',
    headingKeyword: candidate.canonicalKeyword,
    headingSourceLineNumber: candidate.sourceLineNumber,
    headingSourceIndexes: [...candidate.sourceIndexes],
    sourceLineRange: {
      start: candidate.sourceLineNumber,
      end: endLineIndex + 1,
    },
    sourceIndexes: regionLines.flatMap((line) => line.sourceIndexes),
    startBoundary: {
      type: 'heading-line',
      sourceLineNumber: candidate.sourceLineNumber,
    },
    endBoundary: nextCandidate
      ? {
          type: 'before-next-heading',
          sourceLineNumber: nextCandidate.sourceLineNumber,
        }
      : { type: 'text-content-end', sourceLineNumber: lines.length },
    coordinateSpace: 'pdf-user-space',
    coverage: 'text-bounds-only',
    bounds: unionRects(textRects, pageNumber),
    textRects,
    reasonCodes,
  };
}

function resultFor(source, outcome, sequence, reasonCodes, regions) {
  return {
    status: 'regions-ready',
    result: {
      contractVersion: PAGE_ANSWER_REGION_CONTRACT_VERSION,
      sourceContractVersion: PAGE_TEXT_CONTRACT_VERSION,
      coordinateContractVersion: TEXT_COORDINATE_CONTRACT_VERSION,
      keywordContractVersion: KEYWORD_CANDIDATE_CONTRACT_VERSION,
      documentRevision: source.documentRevision,
      pageNumber: source.pageNumber,
      coordinateSpace: 'pdf-user-space',
      outcome,
      sequence,
      reasonCodes: [...new Set(reasonCodes)],
      regionCount: regions.length,
      regions,
    },
  };
}

/** Infer session-only solution/answer region candidates without approving masks. */
export function inferPageAnswerRegions({
  source,
  assessment,
  coordinates,
  keywordCandidates,
} = {}) {
  if (!isPageTextSource(source))
    return { status: 'error', code: 'INVALID_TEXT_SOURCE' };
  if (!hasMatchingAssessment(source, assessment))
    return { status: 'error', code: 'INVALID_PAGE_TEXT_ASSESSMENT' };
  if (assessment.quality !== 'text-usable') {
    return {
      status: 'skipped',
      code: 'TEXT_NOT_USABLE',
      documentRevision: source.documentRevision,
      pageNumber: source.pageNumber,
      reasonCodes: [...assessment.reasonCodes],
    };
  }
  if (!hasMatchingCoordinates(source, coordinates))
    return { status: 'error', code: 'INVALID_TEXT_COORDINATES' };

  const sourceLines = createSourceLines(source.items);
  if (!hasMatchingKeywordCandidates(source, keywordCandidates, sourceLines))
    return { status: 'error', code: 'INVALID_KEYWORD_CANDIDATES' };
  if (keywordCandidates.candidateCount === 0)
    return resultFor(
      source,
      'no-candidates',
      null,
      ['NO_HEADING_CANDIDATES'],
      [],
    );

  const lines = createGeometryLines(sourceLines, coordinates);
  const geometryReasonCodes = findGeometryReasonCodes(source, lines);
  if (geometryReasonCodes.length > 0)
    return resultFor(source, 'uncertain', null, geometryReasonCodes, []);

  const candidates = [...keywordCandidates.candidates].sort(
    (left, right) => left.sourceLineNumber - right.sourceLineNumber,
  );
  const solutionCount = candidates.filter(
    (candidate) => candidate.kind === 'solution-heading',
  ).length;
  const answerCount = candidates.filter(
    (candidate) => candidate.kind === 'answer-heading',
  ).length;
  const ambiguityReasons = [];
  if (solutionCount > 1) ambiguityReasons.push('MULTIPLE_SOLUTION_HEADINGS');
  if (answerCount > 1) ambiguityReasons.push('MULTIPLE_ANSWER_HEADINGS');
  if (ambiguityReasons.length > 0)
    return resultFor(source, 'uncertain', null, ambiguityReasons, []);

  const reasonCodes = [];
  if (solutionCount === 0) reasonCodes.push('MISSING_SOLUTION_HEADING');
  if (answerCount === 0) reasonCodes.push('MISSING_ANSWER_HEADING');
  if (candidates[0].sourceLineNumber === 1)
    reasonCodes.push('NO_PRECEDING_PROBLEM_CONTENT');
  const regions = candidates.map((candidate, index) =>
    createRegion(
      candidate,
      candidates[index + 1],
      lines,
      source.pageNumber,
      index,
    ),
  );
  reasonCodes.push(...regions.flatMap((region) => region.reasonCodes));
  return resultFor(
    source,
    'candidate-regions',
    sequenceFor(candidates),
    reasonCodes,
    regions,
  );
}
