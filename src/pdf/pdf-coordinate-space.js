const RIGHT_ANGLE_ROTATIONS = new Set([0, 90, 180, 270]);

function isFiniteArray(value, length) {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every(Number.isFinite)
  );
}

function normalizeRotation(rotation) {
  if (!Number.isFinite(rotation)) return null;
  const normalized = ((rotation % 360) + 360) % 360;
  return RIGHT_ANGLE_ROTATIONS.has(normalized) ? normalized : null;
}

function validatePage(page) {
  if (
    !page ||
    !isFiniteArray(page.viewBox, 4) ||
    page.viewBox[2] <= page.viewBox[0] ||
    page.viewBox[3] <= page.viewBox[1] ||
    !Number.isFinite(page.userUnit) ||
    page.userUnit <= 0
  ) {
    throw new RangeError('Invalid PDF page geometry');
  }
  const rotation = normalizeRotation(page.rotation);
  if (rotation === null) throw new RangeError('Unsupported PDF page rotation');
  return rotation;
}

function applyTransform([a, b, c, d, e, f], x, y) {
  return [a * x + c * y + e, b * x + d * y + f];
}

/**
 * Build the plain-data equivalent of PDF.js PageViewport geometry.
 * Its dimensions and transform are CSS-pixel coordinates; Canvas DPR is separate.
 */
export function createViewportGeometry(page, { scale = 1 } = {}) {
  const rotation = validatePage(page);
  if (!Number.isFinite(scale) || scale <= 0)
    throw new RangeError('Invalid viewport scale');

  const [xMin, yMin, xMax, yMax] = page.viewBox;
  const centerX = (xMax + xMin) / 2;
  const centerY = (yMax + yMin) / 2;
  const viewportScale = scale * page.userUnit;
  if (!Number.isFinite(viewportScale) || viewportScale <= 0)
    throw new RangeError('Viewport scale exceeds finite geometry');
  let rotateA;
  let rotateB;
  let rotateC;
  let rotateD;

  switch (rotation) {
    case 0:
      rotateA = 1;
      rotateB = 0;
      rotateC = 0;
      rotateD = -1;
      break;
    case 90:
      rotateA = 0;
      rotateB = 1;
      rotateC = 1;
      rotateD = 0;
      break;
    case 180:
      rotateA = -1;
      rotateB = 0;
      rotateC = 0;
      rotateD = 1;
      break;
    case 270:
      rotateA = 0;
      rotateB = -1;
      rotateC = -1;
      rotateD = 0;
      break;
  }

  const isQuarterTurn = rotateA === 0;
  const offsetCanvasX = isQuarterTurn
    ? Math.abs(centerY - yMin) * viewportScale
    : Math.abs(centerX - xMin) * viewportScale;
  const offsetCanvasY = isQuarterTurn
    ? Math.abs(centerX - xMin) * viewportScale
    : Math.abs(centerY - yMin) * viewportScale;
  const transform = [
    rotateA * viewportScale,
    rotateB * viewportScale,
    rotateC * viewportScale,
    rotateD * viewportScale,
    offsetCanvasX -
      rotateA * viewportScale * centerX -
      rotateC * viewportScale * centerY,
    offsetCanvasY -
      rotateB * viewportScale * centerX -
      rotateD * viewportScale * centerY,
  ];
  const width = (isQuarterTurn ? yMax - yMin : xMax - xMin) * viewportScale;
  const height = (isQuarterTurn ? xMax - xMin : yMax - yMin) * viewportScale;
  if (![...transform, width, height].every(Number.isFinite))
    throw new RangeError('Viewport geometry exceeds finite coordinates');

  return {
    coordinateSpace: 'viewport-css-px',
    scale,
    rotation,
    width,
    height,
    transform,
  };
}

export function convertPdfPointToViewport(viewport, x, y) {
  if (!isFiniteArray(viewport?.transform, 6))
    throw new TypeError('Invalid viewport geometry');
  if (!Number.isFinite(x) || !Number.isFinite(y))
    throw new TypeError('Invalid PDF point');
  return applyTransform(viewport.transform, x, y);
}

export function convertViewportPointToPdf(viewport, x, y) {
  if (!isFiniteArray(viewport?.transform, 6))
    throw new TypeError('Invalid viewport geometry');
  if (!Number.isFinite(x) || !Number.isFinite(y))
    throw new TypeError('Invalid viewport point');
  const [a, b, c, d, e, f] = viewport.transform;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || determinant === 0)
    throw new RangeError('Non-invertible viewport geometry');
  const translatedX = x - e;
  const translatedY = y - f;
  return [
    (d * translatedX - c * translatedY) / determinant,
    (-b * translatedX + a * translatedY) / determinant,
  ];
}

/** Project an axis-aligned PDF user-space rectangle into viewport CSS pixels. */
export function projectPdfRectToViewport(viewport, rect) {
  if (
    !rect ||
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    rect.width < 0 ||
    !Number.isFinite(rect.height) ||
    rect.height < 0
  ) {
    throw new TypeError('Invalid PDF rectangle');
  }
  const points = [
    convertPdfPointToViewport(viewport, rect.x, rect.y),
    convertPdfPointToViewport(viewport, rect.x + rect.width, rect.y),
    convertPdfPointToViewport(viewport, rect.x, rect.y + rect.height),
    convertPdfPointToViewport(
      viewport,
      rect.x + rect.width,
      rect.y + rect.height,
    ),
  ];
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    coordinateSpace: 'viewport-css-px',
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}
