import {
  isPageTextSource,
  PAGE_TEXT_CONTRACT_VERSION,
} from '../shared/page-text-contract.js';

export const TEXT_COORDINATE_CONTRACT_VERSION = 1;
export const DEFAULT_FONT_ASCENT = 0.8;
export const DEFAULT_FONT_DESCENT = -0.2;

function resolveFontMetrics(style) {
  let ascent = style.ascent;
  let descent = style.descent;
  if (ascent === 0 && descent === 0) {
    ascent = DEFAULT_FONT_ASCENT;
    descent = DEFAULT_FONT_DESCENT;
  } else if (ascent === 0) {
    ascent = 1 + descent;
  } else if (descent === 0) {
    descent = ascent - 1;
  }
  return ascent > descent ? { ascent, descent } : null;
}

function transformPoint([a, b, c, d, e, f], x, y) {
  return [a * x + c * y + e, b * x + d * y + f];
}

function toBoundingBox(points) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const xMax = Math.max(...xs);
  const yMax = Math.max(...ys);
  if (![x, y, xMax, yMax].every(Number.isFinite)) return null;
  return {
    x: Object.is(x, -0) ? 0 : x,
    y: Object.is(y, -0) ? 0 : y,
    width: Object.is(xMax - x, -0) ? 0 : xMax - x,
    height: Object.is(yMax - y, -0) ? 0 : yMax - y,
  };
}

function createHorizontalBox(item, metrics) {
  const [a, b, c, d] = item.transform;
  const advanceScale = Math.hypot(a, b);
  const fontScale = Math.hypot(c, d);
  if (
    advanceScale === 0 ||
    fontScale === 0 ||
    item.width < 0 ||
    item.height < 0
  ) {
    return null;
  }
  const advance = item.width / advanceScale;
  return toBoundingBox([
    transformPoint(item.transform, 0, metrics.descent),
    transformPoint(item.transform, advance, metrics.descent),
    transformPoint(item.transform, 0, metrics.ascent),
    transformPoint(item.transform, advance, metrics.ascent),
  ]);
}

function createVerticalBox(item, metrics) {
  const [a, b, c, d, e, f] = item.transform;
  const crossScale = Math.hypot(a, b);
  const advanceScale = Math.hypot(c, d);
  if (
    crossScale === 0 ||
    advanceScale === 0 ||
    item.width < 0 ||
    item.height < 0
  ) {
    return null;
  }
  const advanceX = (-c / advanceScale) * item.height;
  const advanceY = (-d / advanceScale) * item.height;
  const crossAtDescent = [e + a * metrics.descent, f + b * metrics.descent];
  const crossAtAscent = [e + a * metrics.ascent, f + b * metrics.ascent];
  return toBoundingBox([
    crossAtDescent,
    crossAtAscent,
    [crossAtDescent[0] + advanceX, crossAtDescent[1] + advanceY],
    [crossAtAscent[0] + advanceX, crossAtAscent[1] + advanceY],
  ]);
}

function isSupportedPage(page) {
  const [xMin, yMin, xMax, yMax] = page.viewBox;
  const rotation = ((page.rotation % 360) + 360) % 360;
  return xMax > xMin && yMax > yMin && [0, 90, 180, 270].includes(rotation);
}

function unsupported(source, code) {
  return {
    status: 'unsupported',
    code,
    contractVersion: TEXT_COORDINATE_CONTRACT_VERSION,
    documentRevision: source.documentRevision,
    pageNumber: source.pageNumber,
  };
}

/**
 * Derive approximate axis-aligned text boxes in unrotated PDF user space.
 * Raw transforms remain in PageTextSource; this result is session-only data.
 */
export function createPageTextCoordinates(source) {
  if (!isPageTextSource(source))
    return { status: 'error', code: 'INVALID_TEXT_SOURCE' };
  if (!isSupportedPage(source.page))
    return unsupported(source, 'UNSUPPORTED_PAGE_GEOMETRY');

  const styles = new Map(source.styles.map((style) => [style.fontName, style]));
  const items = [];
  for (const item of source.items) {
    const style = styles.get(item.fontName);
    const metrics = resolveFontMetrics(style);
    if (!metrics) return unsupported(source, 'UNSUPPORTED_FONT_METRICS');
    const bbox = style.vertical
      ? createVerticalBox(item, metrics)
      : createHorizontalBox(item, metrics);
    if (!bbox) return unsupported(source, 'UNSUPPORTED_TEXT_GEOMETRY');
    items.push({
      sourceIndex: item.sourceIndex,
      text: item.sourceText,
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      page: source.pageNumber,
    });
  }

  return {
    status: 'coordinates-ready',
    coordinates: {
      contractVersion: TEXT_COORDINATE_CONTRACT_VERSION,
      sourceContractVersion: PAGE_TEXT_CONTRACT_VERSION,
      documentRevision: source.documentRevision,
      pageNumber: source.pageNumber,
      coordinateSpace: 'pdf-user-space',
      page: {
        viewBox: [...source.page.viewBox],
        userUnit: source.page.userUnit,
        rotation: ((source.page.rotation % 360) + 360) % 360,
      },
      items,
    },
  };
}
