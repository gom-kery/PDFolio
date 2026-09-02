import {
  isPageTextSource,
  PAGE_TEXT_CONTRACT_VERSION,
} from '../shared/page-text-contract.js';

export const KEYWORD_CANDIDATE_CONTRACT_VERSION = 1;

export const PAGE_HEADING_KEYWORDS = Object.freeze([
  Object.freeze({
    canonicalKeyword: 'Explanation',
    kind: 'solution-heading',
    language: 'en',
  }),
  Object.freeze({
    canonicalKeyword: 'Solution',
    kind: 'solution-heading',
    language: 'en',
  }),
  Object.freeze({
    canonicalKeyword: 'Answer',
    kind: 'answer-heading',
    language: 'en',
  }),
  Object.freeze({
    canonicalKeyword: '해설',
    kind: 'solution-heading',
    language: 'ko',
  }),
  Object.freeze({
    canonicalKeyword: '풀이',
    kind: 'solution-heading',
    language: 'ko',
  }),
  Object.freeze({
    canonicalKeyword: '정답',
    kind: 'answer-heading',
    language: 'ko',
  }),
  Object.freeze({
    canonicalKeyword: '답',
    kind: 'answer-heading',
    language: 'ko',
  }),
]);

const HEADING_PREFIX_PATTERN = /^[\s•●○■□▪▫◦※▶▷▸▹*\-–—]*/u;
const DELIMITER_PATTERN = /^\s*[:：=·.\-–—]\s*/u;
const ENGLISH_SOLUTION_FALSE_POSITIVES =
  /^(?:manual|guide|book|section|example)s?(?:\s|$)/iu;
const ANSWER_VALUE_PATTERN =
  /^(?:[①②③④⑤⑥⑦⑧⑨⑩]|(?:10|[1-9])(?:번)?|[A-Ga-g])(?=\s|$|[.)]|이|입)/u;

function foldKeyword(text, language) {
  return language === 'en' ? text.toLocaleLowerCase('en-US') : text;
}

function createSourceLines(items) {
  const lines = [];
  let text = '';
  let segments = [];
  const flush = () => {
    if (segments.length === 0 && text.length === 0) return;
    lines.push({ text, segments });
    text = '';
    segments = [];
  };

  for (const item of items) {
    const start = text.length;
    text += item.sourceText;
    segments.push({
      sourceIndex: item.sourceIndex,
      start,
      end: text.length,
    });
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}

function classifyAnswerContent(content) {
  let candidate = content;
  const englishCopula = /^is(?:\s+|\s*[:：=]\s*)/iu.exec(candidate);
  if (englishCopula) candidate = candidate.slice(englishCopula[0].length);
  return ANSWER_VALUE_PATTERN.test(candidate) ? 'heading-with-answer' : null;
}

function classifyContext(rule, remainder) {
  if (remainder.length === 0 || remainder.trim().length === 0)
    return 'standalone-heading';
  if (DELIMITER_PATTERN.test(remainder)) return 'heading-with-delimiter';

  if (rule.language === 'ko' && rule.kind === 'answer-heading') {
    const copula = /^(?:은|는)\s*/u.exec(remainder);
    if (copula) return classifyAnswerContent(remainder.slice(copula[0].length));
  }

  if (!/^\s/u.test(remainder)) return null;
  const content = remainder.trimStart();
  if (rule.kind === 'answer-heading') return classifyAnswerContent(content);
  if (rule.language === 'en' && ENGLISH_SOLUTION_FALSE_POSITIVES.test(content))
    return null;
  return 'heading-with-content';
}

function sourceIndexesForRange(segments, start, end) {
  return segments
    .filter((segment) => segment.end > start && segment.start < end)
    .map((segment) => segment.sourceIndex);
}

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

/** Find heading-like keywords without inferring a solution/answer region. */
export function findPageKeywordCandidates({ source, assessment } = {}) {
  if (!isPageTextSource(source))
    return { status: 'error', code: 'INVALID_TEXT_SOURCE' };
  if (!hasMatchingAssessment(source, assessment)) {
    return {
      status: 'error',
      code: 'INVALID_PAGE_TEXT_ASSESSMENT',
      documentRevision: source.documentRevision,
      pageNumber: source.pageNumber,
    };
  }
  if (assessment.quality !== 'text-usable') {
    return {
      status: 'skipped',
      code: 'TEXT_NOT_USABLE',
      documentRevision: source.documentRevision,
      pageNumber: source.pageNumber,
      reasonCodes: [...assessment.reasonCodes],
    };
  }

  const candidates = [];
  const lines = createSourceLines(source.items);
  for (const [lineIndex, line] of lines.entries()) {
    const prefixLength = line.text.match(HEADING_PREFIX_PATTERN)[0].length;
    const headingText = line.text.slice(prefixLength);
    for (const rule of PAGE_HEADING_KEYWORDS) {
      const keywordLength = rule.canonicalKeyword.length;
      const possibleKeyword = headingText.slice(0, keywordLength);
      if (
        foldKeyword(possibleKeyword, rule.language) !==
        foldKeyword(rule.canonicalKeyword, rule.language)
      )
        continue;
      const context = classifyContext(rule, headingText.slice(keywordLength));
      if (!context) continue;
      const matchStart = prefixLength;
      const matchEnd = matchStart + keywordLength;
      const sourceIndexes = sourceIndexesForRange(
        line.segments,
        matchStart,
        matchEnd,
      );
      if (sourceIndexes.length === 0) continue;
      candidates.push({
        canonicalKeyword: rule.canonicalKeyword,
        matchedText: line.text.slice(matchStart, matchEnd),
        kind: rule.kind,
        language: rule.language,
        context,
        matchMode:
          sourceIndexes.length === 1 ? 'single-item' : 'fragmented-items',
        sourceIndexes,
        sourceLineNumber: lineIndex + 1,
      });
      break;
    }
  }

  return {
    status: 'candidates-ready',
    result: {
      contractVersion: KEYWORD_CANDIDATE_CONTRACT_VERSION,
      sourceContractVersion: PAGE_TEXT_CONTRACT_VERSION,
      documentRevision: source.documentRevision,
      pageNumber: source.pageNumber,
      candidateCount: candidates.length,
      candidates,
    },
  };
}
