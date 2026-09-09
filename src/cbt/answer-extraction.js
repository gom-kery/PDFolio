import { isPageTextSource } from '../shared/page-text-contract.js';

export const ANSWER_EXTRACTION_CONTRACT_VERSION = 1;
export const ANSWER_EXTRACTION_STATUSES = Object.freeze([
  'known',
  'unknown',
  'ambiguous',
]);

const CIRCLED_VALUES = Object.freeze({
  '①': 1,
  '②': 2,
  '③': 3,
  '④': 4,
  '⑤': 5,
  '⑥': 6,
  '⑦': 7,
  '⑧': 8,
  '⑨': 9,
});
const SUPPORTED_CHOICE_COUNTS = new Set([4, 5]);

function hasPositiveRect(rect) {
  return (
    rect &&
    rect.coordinateSpace === 'pdf-user-space' &&
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function overlaps(rect, item) {
  return (
    Math.min(rect.x + rect.width, item.x + item.width) >
      Math.max(rect.x, item.x) &&
    Math.min(rect.y + rect.height, item.y + item.height) >
      Math.max(rect.y, item.y)
  );
}

function hasMatchingCoordinates(source, coordinates) {
  return (
    coordinates &&
    coordinates.status === undefined &&
    coordinates.contractVersion === 1 &&
    coordinates.coordinateSpace === 'pdf-user-space' &&
    coordinates.documentRevision === source.documentRevision &&
    coordinates.pageNumber === source.pageNumber &&
    Array.isArray(coordinates.items) &&
    coordinates.items.every(
      (item) =>
        Number.isSafeInteger(item.sourceIndex) &&
        typeof item.text === 'string' &&
        [item.x, item.y, item.width, item.height].every(Number.isFinite) &&
        item.width >= 0 &&
        item.height >= 0 &&
        item.page === source.pageNumber,
    )
  );
}

function isQuestionContext(question, source) {
  return (
    question &&
    typeof question.questionId === 'string' &&
    question.questionId.length > 0 &&
    Number.isSafeInteger(question.documentRevision) &&
    question.documentRevision === source.documentRevision &&
    SUPPORTED_CHOICE_COUNTS.has(question.choiceCount) &&
    Array.isArray(question.pageRefs) &&
    question.pageRefs.length === 1 &&
    question.pageRefs[0] === source.pageNumber
  );
}

function isAnswerRegion(region, question) {
  return (
    region &&
    typeof region.regionId === 'string' &&
    region.regionId.length > 0 &&
    region.questionId === question.questionId &&
    region.documentRevision === question.documentRevision &&
    region.pageNumber === question.pageRefs[0] &&
    region.kind === 'answer' &&
    hasPositiveRect(region.rect)
  );
}

function resultFor({
  question,
  answerRegion,
  status,
  value = null,
  reasonCodes,
  sourceItemCount,
  candidateCount,
}) {
  return {
    contractVersion: ANSWER_EXTRACTION_CONTRACT_VERSION,
    questionId: question.questionId,
    documentRevision: question.documentRevision,
    answerRegionId: answerRegion.regionId,
    status,
    value,
    reasonCodes: [...reasonCodes],
    sourceItemCount,
    candidateCount,
  };
}

function findCandidates(text) {
  const candidates = [];
  for (const character of text) {
    if (Object.hasOwn(CIRCLED_VALUES, character))
      candidates.push(CIRCLED_VALUES[character]);
  }

  const labeledNumber =
    /(?:정답|답|answer)\s*(?:은|is)?\s*[:：-]?\s*([0-9])(?:\s*번)?(?!\d)/gi;
  for (const match of text.matchAll(labeledNumber))
    candidates.push(Number(match[1]));

  if (candidates.length === 0) {
    const standalone = text.trim().match(/^([0-9])(?:\s*번)?$/);
    if (standalone) candidates.push(Number(standalone[1]));
  }
  return candidates;
}

/**
 * Extract only a single 1–5 answer value from a user-confirmed answer Region.
 * It returns status and compact evidence counts, never source text or coordinates.
 */
export function extractManualAnswerValue({
  source,
  coordinates,
  question,
  answerRegion,
} = {}) {
  if (!isPageTextSource(source))
    return { status: 'error', code: 'INVALID_TEXT_SOURCE' };
  if (!hasMatchingCoordinates(source, coordinates))
    return { status: 'error', code: 'INVALID_TEXT_COORDINATES' };
  if (!isQuestionContext(question, source))
    return { status: 'error', code: 'INVALID_QUESTION_CONTEXT' };
  if (!isAnswerRegion(answerRegion, question))
    return { status: 'error', code: 'INVALID_ANSWER_REGION' };

  const sourceIndexes = new Set(source.items.map((item) => item.sourceIndex));
  const matched = coordinates.items
    .filter(
      (item) =>
        sourceIndexes.has(item.sourceIndex) &&
        item.width > 0 &&
        item.height > 0 &&
        overlaps(answerRegion.rect, item),
    )
    .sort((left, right) => left.sourceIndex - right.sourceIndex);
  const sourceItemCount = matched.length;
  const candidates = findCandidates(matched.map((item) => item.text).join(' '));

  if (sourceItemCount === 0)
    return resultFor({
      question,
      answerRegion,
      status: 'unknown',
      reasonCodes: ['ANSWER_REGION_TEXT_NOT_FOUND'],
      sourceItemCount,
      candidateCount: 0,
    });
  if (candidates.length === 0)
    return resultFor({
      question,
      answerRegion,
      status: 'unknown',
      reasonCodes: ['ANSWER_VALUE_NOT_FOUND'],
      sourceItemCount,
      candidateCount: 0,
    });
  if (candidates.some((value) => value < 1 || value > 5))
    return resultFor({
      question,
      answerRegion,
      status: 'unknown',
      reasonCodes: ['ANSWER_VALUE_OUT_OF_SUPPORTED_RANGE'],
      sourceItemCount,
      candidateCount: candidates.length,
    });
  if (candidates.length !== 1)
    return resultFor({
      question,
      answerRegion,
      status: 'ambiguous',
      reasonCodes: ['MULTIPLE_ANSWER_VALUES'],
      sourceItemCount,
      candidateCount: candidates.length,
    });
  if (candidates[0] > question.choiceCount)
    return resultFor({
      question,
      answerRegion,
      status: 'unknown',
      reasonCodes: ['ANSWER_VALUE_EXCEEDS_CHOICE_COUNT'],
      sourceItemCount,
      candidateCount: 1,
    });
  return resultFor({
    question,
    answerRegion,
    status: 'known',
    value: candidates[0],
    reasonCodes: [],
    sourceItemCount,
    candidateCount: 1,
  });
}
