export const PAGE_TEXT_CONTRACT_VERSION = 1;

const SOURCE_KEYS = [
  'contractVersion',
  'documentRevision',
  'pageNumber',
  'pageCount',
  'language',
  'page',
  'items',
  'styles',
];
const PAGE_KEYS = ['viewBox', 'userUnit', 'rotation'];
const ITEM_KEYS = [
  'sourceIndex',
  'sourceText',
  'direction',
  'transform',
  'width',
  'height',
  'fontName',
  'hasEOL',
];
const STYLE_KEYS = ['fontName', 'ascent', 'descent', 'vertical', 'fontFamily'];

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value, allowedKeys) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === allowedKeys.length &&
    keys.every((key) => allowedKeys.includes(key))
  );
}

function isFiniteNumberArray(value, length) {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every(Number.isFinite)
  );
}

export function hasPageTextContext(value) {
  return (
    Number.isSafeInteger(value?.documentRevision) &&
    value.documentRevision > 0 &&
    Number.isSafeInteger(value?.pageNumber) &&
    value.pageNumber > 0
  );
}

function isValidPage(value) {
  return (
    hasOnlyKeys(value, PAGE_KEYS) &&
    isFiniteNumberArray(value.viewBox, 4) &&
    Number.isFinite(value.userUnit) &&
    value.userUnit > 0 &&
    Number.isFinite(value.rotation)
  );
}

function isValidItem(value, index) {
  return (
    hasOnlyKeys(value, ITEM_KEYS) &&
    value.sourceIndex === index &&
    typeof value.sourceText === 'string' &&
    ['ltr', 'rtl', 'ttb'].includes(value.direction) &&
    isFiniteNumberArray(value.transform, 6) &&
    Number.isFinite(value.width) &&
    Number.isFinite(value.height) &&
    typeof value.fontName === 'string' &&
    typeof value.hasEOL === 'boolean'
  );
}

function isValidStyle(value) {
  return (
    hasOnlyKeys(value, STYLE_KEYS) &&
    typeof value.fontName === 'string' &&
    Number.isFinite(value.ascent) &&
    Number.isFinite(value.descent) &&
    typeof value.vertical === 'boolean' &&
    typeof value.fontFamily === 'string'
  );
}

/** Validate the exact, plain-data PageTextSource v1 boundary. */
export function isPageTextSource(value) {
  if (
    !hasOnlyKeys(value, SOURCE_KEYS) ||
    value.contractVersion !== PAGE_TEXT_CONTRACT_VERSION ||
    !hasPageTextContext(value) ||
    !Number.isSafeInteger(value.pageCount) ||
    value.pageCount < value.pageNumber ||
    !(value.language === null || typeof value.language === 'string') ||
    !isValidPage(value.page) ||
    !Array.isArray(value.items) ||
    !value.items.every(isValidItem) ||
    !Array.isArray(value.styles) ||
    !value.styles.every(isValidStyle)
  ) {
    return false;
  }

  const styleNames = new Set(value.styles.map((style) => style.fontName));
  if (styleNames.size !== value.styles.length) return false;
  const referencedStyleNames = new Set(
    value.items.map((item) => item.fontName),
  );
  return (
    referencedStyleNames.size === styleNames.size &&
    [...referencedStyleNames].every((fontName) => styleNames.has(fontName))
  );
}
