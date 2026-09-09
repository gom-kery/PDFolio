import {
  isPageTextSource,
  PAGE_TEXT_CONTRACT_VERSION,
} from '../shared/page-text-contract.js';
import { TEXT_COORDINATE_CONTRACT_VERSION } from './page-text-coordinates.js';
import { KEYWORD_CANDIDATE_CONTRACT_VERSION } from './page-keyword-candidates.js';

export const PAGE_QUESTION_CANDIDATE_CONTRACT_VERSION = 1;

const QUESTION_NUMBER_PATTERN =
  /^\s*(?:(?:question\s*)(\d{1,3})|(\d{2,3}))\s*[.)．]/iu;
const CIRCLED_CHOICE_VALUES = Object.freeze({
  '①': 1,
  '②': 2,
  '③': 3,
  '④': 4,
  '⑤': 5,
});
const MIN_COLUMN_GAP_PAGE_RATIO = 0.2;
const COLUMN_ASSIGNMENT_TOLERANCE = 24;
const VERTICAL_TOLERANCE = 2;

function sameNumbers(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function hasMatchingAssessment(source, assessment) {
  return (
    assessment &&
    assessment.contractVersion === PAGE_TEXT_CONTRACT_VERSION &&
    assessment.documentRevision === source.documentRevision &&
    assessment.pageNumber === source.pageNumber &&
    assessment.quality === 'text-usable' &&
    Array.isArray(assessment.reasonCodes)
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
    coordinates.page.rotation === source.page.rotation &&
    Array.isArray(coordinates.items) &&
    coordinates.items.length === source.items.length &&
    coordinates.items.every((item, index) => {
      const sourceItem = source.items[index];
      return (
        item?.sourceIndex === sourceItem.sourceIndex &&
        item.text === sourceItem.sourceText &&
        [item.x, item.y, item.width, item.height].every(Number.isFinite) &&
        item.width >= 0 &&
        item.height > 0
      );
    })
  );
}

function hasMatchingKeywordCandidates(source, keywordCandidates) {
  return (
    keywordCandidates &&
    keywordCandidates.contractVersion === KEYWORD_CANDIDATE_CONTRACT_VERSION &&
    keywordCandidates.sourceContractVersion === PAGE_TEXT_CONTRACT_VERSION &&
    keywordCandidates.documentRevision === source.documentRevision &&
    keywordCandidates.pageNumber === source.pageNumber &&
    Number.isSafeInteger(keywordCandidates.candidateCount) &&
    keywordCandidates.candidateCount >= 0 &&
    Array.isArray(keywordCandidates.candidates) &&
    keywordCandidates.candidateCount === keywordCandidates.candidates.length &&
    keywordCandidates.candidates.every(
      (candidate) =>
        Number.isSafeInteger(candidate?.sourceLineNumber) &&
        candidate.sourceLineNumber > 0 &&
        Array.isArray(candidate.sourceIndexes),
    )
  );
}

function createLines(source, coordinates) {
  const coordinateByIndex = new Map(
    coordinates.items.map((item) => [item.sourceIndex, item]),
  );
  const lines = [];
  let items = [];
  const flush = () => {
    if (items.length === 0) return;
    const xValues = items.map((item) => item.coordinate.x);
    const yValues = items.map((item) => item.coordinate.y);
    const rightValues = items.map(
      (item) => item.coordinate.x + item.coordinate.width,
    );
    const topValues = items.map(
      (item) => item.coordinate.y + item.coordinate.height,
    );
    lines.push({
      sourceLineNumber: lines.length + 1,
      sourceIndexes: items.map((item) => item.sourceIndex),
      text: items.map((item) => item.text).join(''),
      x: Math.min(...xValues),
      y: Math.min(...yValues),
      width: Math.max(...rightValues) - Math.min(...xValues),
      height: Math.max(...topValues) - Math.min(...yValues),
    });
    items = [];
  };

  for (const item of source.items) {
    items.push({
      sourceIndex: item.sourceIndex,
      text: item.sourceText,
      coordinate: coordinateByIndex.get(item.sourceIndex),
    });
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}

function questionNumberForLine(line) {
  const match = line.text.match(QUESTION_NUMBER_PATTERN);
  return match ? (match[1] ?? match[2]) : null;
}

function choiceValuesForLine(line) {
  const values = new Set();
  for (const character of line.text) {
    const value = CIRCLED_CHOICE_VALUES[character];
    if (value) values.add(value);
  }
  const numericChoice = /(?:^|[\s(])([1-5])\s*[.)](?=\s|$)/gu;
  for (const match of line.text.matchAll(numericChoice))
    values.add(Number(match[1]));
  return values;
}

function pageWidth(page) {
  return page.viewBox[2] - page.viewBox[0];
}

function clusterQuestionStarts(questionStarts, page) {
  const requiredGap = Math.max(
    COLUMN_ASSIGNMENT_TOLERANCE * 2,
    pageWidth(page) * MIN_COLUMN_GAP_PAGE_RATIO,
  );
  const clusters = [];
  for (const start of [...questionStarts].sort(
    (left, right) => left.x - right.x,
  )) {
    const nearest = clusters.findLast(
      (cluster) => Math.abs(cluster.center - start.x) < requiredGap,
    );
    if (nearest) {
      nearest.starts.push(start);
      nearest.center =
        nearest.starts.reduce((sum, item) => sum + item.x, 0) /
        nearest.starts.length;
    } else {
      clusters.push({ center: start.x, starts: [start] });
    }
  }
  return clusters.sort((left, right) => left.center - right.center);
}

function assignColumn(line, clusters) {
  const distances = clusters.map((cluster) =>
    Math.abs(cluster.center - line.x),
  );
  const smallest = Math.min(...distances);
  const indexes = distances
    .map((distance, index) => (distance === smallest ? index : null))
    .filter((index) => index !== null);
  if (indexes.length !== 1) return null;
  return indexes[0] + 1;
}

function boundsForLines(lines) {
  const x = Math.min(...lines.map((line) => line.x));
  const y = Math.min(...lines.map((line) => line.y));
  const xMax = Math.max(...lines.map((line) => line.x + line.width));
  const yMax = Math.max(...lines.map((line) => line.y + line.height));
  return { x, y, width: xMax - x, height: yMax - y };
}

function boundsOverlap(left, right) {
  return (
    Math.min(left.x + left.width, right.x + right.width) -
      Math.max(left.x, right.x) >
      VERTICAL_TOLERANCE &&
    Math.min(left.y + left.height, right.y + right.height) -
      Math.max(left.y, right.y) >
      VERTICAL_TOLERANCE
  );
}

function normalizeCandidate(candidate) {
  return {
    candidateKey: candidate.candidateKey,
    printedQuestionNumber: candidate.printedQuestionNumber,
    columnIndex: candidate.columnIndex,
    columnCount: candidate.columnCount,
    sourceLineRange: {
      start: candidate.sourceLineRange.start,
      end: candidate.sourceLineRange.end,
    },
    questionSourceIndexes: [...candidate.questionSourceIndexes],
    choiceCount: candidate.choiceCount,
    answerHeadingSourceIndexes: candidate.answerHeadingSourceIndexes
      ? [...candidate.answerHeadingSourceIndexes]
      : null,
    bounds: { ...candidate.bounds },
    status: candidate.status,
    reasonCodes: [...candidate.reasonCodes],
  };
}

function candidateResult(source, outcome, candidates, reasonCodes = []) {
  const normalizedCandidates = candidates.map(normalizeCandidate);
  return {
    status: 'question-candidates-ready',
    result: {
      contractVersion: PAGE_QUESTION_CANDIDATE_CONTRACT_VERSION,
      sourceContractVersion: PAGE_TEXT_CONTRACT_VERSION,
      coordinateContractVersion: TEXT_COORDINATE_CONTRACT_VERSION,
      keywordContractVersion: KEYWORD_CANDIDATE_CONTRACT_VERSION,
      documentRevision: source.documentRevision,
      pageNumber: source.pageNumber,
      outcome,
      candidateCount: normalizedCandidates.length,
      draftCount: normalizedCandidates.filter(
        (candidate) => candidate.status === 'draft',
      ).length,
      holdCount: normalizedCandidates.filter(
        (candidate) => candidate.status === 'hold',
      ).length,
      candidates: normalizedCandidates,
      reasonCodes: [...reasonCodes],
    },
  };
}

/**
 * Finds draft-only multiple-question candidates on one unrotated, text-usable
 * page. It never creates a Question/Region or changes manual confirmations.
 */
export function inferPageQuestionCandidates({
  source,
  assessment,
  coordinates,
  keywordCandidates,
} = {}) {
  if (!isPageTextSource(source))
    return { status: 'error', code: 'INVALID_TEXT_SOURCE' };
  if (!hasMatchingAssessment(source, assessment)) {
    if (assessment?.quality !== 'text-usable')
      return { status: 'skipped', code: 'TEXT_NOT_USABLE' };
    return { status: 'error', code: 'INVALID_PAGE_TEXT_ASSESSMENT' };
  }
  if (!hasMatchingCoordinates(source, coordinates))
    return { status: 'error', code: 'INVALID_TEXT_COORDINATES' };
  if (!hasMatchingKeywordCandidates(source, keywordCandidates))
    return { status: 'error', code: 'INVALID_KEYWORD_CANDIDATES' };
  if (source.page.rotation !== 0)
    return candidateResult(
      source,
      'uncertain',
      [],
      ['ROTATED_READING_ORDER_UNVERIFIED'],
    );
  if (source.items.some((item) => item.direction !== 'ltr'))
    return candidateResult(
      source,
      'uncertain',
      [],
      ['VERTICAL_READING_ORDER_UNVERIFIED'],
    );

  const lines = createLines(source, coordinates);
  const questionStarts = lines
    .map((line) => ({
      ...line,
      printedQuestionNumber: questionNumberForLine(line),
    }))
    .filter((line) => line.printedQuestionNumber !== null);
  if (questionStarts.length < 2)
    return candidateResult(
      source,
      'no-candidates',
      [],
      ['NOT_MULTI_QUESTION_PAGE'],
    );

  const clusters = clusterQuestionStarts(questionStarts, source.page);
  const linesByColumn = new Map(clusters.map((_, index) => [index + 1, []]));
  for (const line of lines) {
    const columnIndex = assignColumn(line, clusters);
    if (!columnIndex)
      return candidateResult(
        source,
        'uncertain',
        [],
        ['AMBIGUOUS_COLUMN_ASSIGNMENT'],
      );
    linesByColumn.get(columnIndex).push(line);
  }
  const answerHeadingsByLine = new Map(
    keywordCandidates.candidates
      .filter((candidate) => candidate.kind === 'answer-heading')
      .map((candidate) => [candidate.sourceLineNumber, candidate]),
  );
  const duplicateQuestionNumbers = new Set(
    questionStarts
      .map((start) => start.printedQuestionNumber)
      .filter((value, index, values) => values.indexOf(value) !== index),
  );
  const candidates = [];

  for (const [columnIndex, columnLines] of linesByColumn) {
    const starts = questionStarts
      .filter((start) => assignColumn(start, clusters) === columnIndex)
      .sort((left, right) => right.y - left.y);
    for (const [index, start] of starts.entries()) {
      const next = starts[index + 1] ?? null;
      const segment = columnLines.filter(
        (line) =>
          line.y <= start.y + VERTICAL_TOLERANCE &&
          (!next || line.y > next.y + VERTICAL_TOLERANCE),
      );
      const choiceValues = new Set(
        segment.flatMap((line) => [...choiceValuesForLine(line)]),
      );
      const sortedChoices = [...choiceValues].sort(
        (left, right) => left - right,
      );
      const choiceCount =
        sortedChoices.length === 4 &&
        sortedChoices.every((value, i) => value === i + 1)
          ? 4
          : sortedChoices.length === 5 &&
              sortedChoices.every((value, i) => value === i + 1)
            ? 5
            : null;
      const answerHeadings = segment
        .map((line) => answerHeadingsByLine.get(line.sourceLineNumber))
        .filter(Boolean);
      const reasonCodes = [];
      if (duplicateQuestionNumbers.has(start.printedQuestionNumber))
        reasonCodes.push('DUPLICATE_PRINTED_QUESTION_NUMBER');
      if (choiceCount === null) reasonCodes.push('CHOICE_COUNT_UNVERIFIED');
      if (answerHeadings.length === 0)
        reasonCodes.push('ANSWER_HEADING_MISSING');
      if (answerHeadings.length > 1)
        reasonCodes.push('MULTIPLE_ANSWER_HEADINGS');
      const candidate = {
        candidateKey: `page-${source.pageNumber}-line-${start.sourceLineNumber}`,
        printedQuestionNumber: start.printedQuestionNumber,
        columnIndex,
        columnCount: clusters.length,
        sourceLineRange: {
          start: Math.min(...segment.map((line) => line.sourceLineNumber)),
          end: Math.max(...segment.map((line) => line.sourceLineNumber)),
        },
        questionSourceIndexes: [...start.sourceIndexes],
        choiceCount,
        answerHeadingSourceIndexes:
          answerHeadings.length === 1
            ? [...answerHeadings[0].sourceIndexes]
            : null,
        bounds: boundsForLines(segment),
        status: reasonCodes.length === 0 ? 'draft' : 'hold',
        reasonCodes,
      };
      candidates.push(candidate);
    }
  }

  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < candidates.length;
      rightIndex += 1
    ) {
      const left = candidates[leftIndex];
      const right = candidates[rightIndex];
      if (boundsOverlap(left.bounds, right.bounds)) {
        left.status = 'hold';
        right.status = 'hold';
        if (!left.reasonCodes.includes('CANDIDATE_BOUNDS_OVERLAP'))
          left.reasonCodes.push('CANDIDATE_BOUNDS_OVERLAP');
        if (!right.reasonCodes.includes('CANDIDATE_BOUNDS_OVERLAP'))
          right.reasonCodes.push('CANDIDATE_BOUNDS_OVERLAP');
      }
    }
  }
  return candidateResult(
    source,
    candidates.some((candidate) => candidate.status === 'draft')
      ? 'candidate-questions'
      : 'uncertain',
    candidates,
  );
}
