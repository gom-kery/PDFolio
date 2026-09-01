import {
  hasPageTextContext,
  isPageTextSource,
  PAGE_TEXT_CONTRACT_VERSION,
} from '../shared/page-text-contract.js';

export { PAGE_TEXT_CONTRACT_VERSION };
export const MIN_USABLE_NON_WHITESPACE_CHARACTERS = 12;
export const MIN_READABLE_CHARACTER_RATIO = 0.8;

const EXTRACTION_FAILURE_CODES = new Set([
  'INVALID_TEXT_SOURCE',
  'TEXT_EXTRACTION_FAILED',
]);

function emptyMetrics() {
  return {
    itemCount: 0,
    nonEmptyItemCount: 0,
    sourceCharacterCount: 0,
    nonWhitespaceCharacterCount: 0,
    readableCharacterCount: 0,
    suspiciousCharacterCount: 0,
    readableCharacterRatio: 0,
  };
}

function createFailureAssessment(value, reasonCode) {
  return {
    contractVersion: PAGE_TEXT_CONTRACT_VERSION,
    documentRevision: value.documentRevision,
    pageNumber: value.pageNumber,
    quality: 'unknown',
    reasonCodes: [reasonCode],
    metrics: emptyMetrics(),
    plainText: '',
  };
}

function isReadableCharacter(character) {
  return (
    character !== '\ufffd' && /[\p{L}\p{N}\p{M}\p{P}\p{S}]/u.test(character)
  );
}

/**
 * Classify one PageTextSource without changing its text or inferring layout.
 * Expected extraction failures become an unknown assessment; request failures do not.
 */
export function assessPageText(value) {
  if (value?.status === 'canceled') return null;
  if (value?.status === 'error') {
    if (!EXTRACTION_FAILURE_CODES.has(value.code) || !hasPageTextContext(value))
      return null;
    return createFailureAssessment(value, value.code);
  }

  const source = value?.status === 'extracted' ? value.source : value;
  if (!hasPageTextContext(source)) return null;
  if (!isPageTextSource(source))
    return createFailureAssessment(source, 'INVALID_TEXT_SOURCE');

  const plainText = source.items
    .map((item) => item.sourceText + (item.hasEOL ? '\n' : ''))
    .join('');
  const sourceText = source.items.map((item) => item.sourceText).join('');
  const characters = [...sourceText];
  const nonWhitespaceCharacters = characters.filter(
    (character) => !/\s/u.test(character),
  );
  const readableCharacterCount =
    nonWhitespaceCharacters.filter(isReadableCharacter).length;
  const suspiciousCharacterCount =
    nonWhitespaceCharacters.length - readableCharacterCount;
  const readableCharacterRatio = nonWhitespaceCharacters.length
    ? readableCharacterCount / nonWhitespaceCharacters.length
    : 0;
  const metrics = {
    itemCount: source.items.length,
    nonEmptyItemCount: source.items.filter((item) => item.sourceText.length > 0)
      .length,
    sourceCharacterCount: characters.length,
    nonWhitespaceCharacterCount: nonWhitespaceCharacters.length,
    readableCharacterCount,
    suspiciousCharacterCount,
    readableCharacterRatio,
  };

  if (metrics.itemCount === 0) {
    return {
      contractVersion: PAGE_TEXT_CONTRACT_VERSION,
      documentRevision: source.documentRevision,
      pageNumber: source.pageNumber,
      quality: 'text-insufficient',
      reasonCodes: ['NO_TEXT_ITEMS'],
      metrics,
      plainText,
    };
  }
  if (metrics.nonWhitespaceCharacterCount === 0) {
    return {
      contractVersion: PAGE_TEXT_CONTRACT_VERSION,
      documentRevision: source.documentRevision,
      pageNumber: source.pageNumber,
      quality: 'text-insufficient',
      reasonCodes: ['WHITESPACE_ONLY'],
      metrics,
      plainText,
    };
  }

  const hasLowTextQuality =
    metrics.readableCharacterRatio < MIN_READABLE_CHARACTER_RATIO;
  const hasEnoughReadableText =
    metrics.readableCharacterCount >= MIN_USABLE_NON_WHITESPACE_CHARACTERS;
  const reasonCodes = [];
  if (
    metrics.nonWhitespaceCharacterCount < MIN_USABLE_NON_WHITESPACE_CHARACTERS
  )
    reasonCodes.push('TOO_LITTLE_TEXT');
  if (hasLowTextQuality) reasonCodes.push('LOW_TEXT_QUALITY');
  if (hasLowTextQuality && hasEnoughReadableText)
    reasonCodes.push('CONFLICTING_SIGNALS');

  return {
    contractVersion: PAGE_TEXT_CONTRACT_VERSION,
    documentRevision: source.documentRevision,
    pageNumber: source.pageNumber,
    quality:
      hasLowTextQuality && hasEnoughReadableText
        ? 'unknown'
        : reasonCodes.length > 0
          ? 'text-insufficient'
          : 'text-usable',
    reasonCodes,
    metrics,
    plainText,
  };
}
