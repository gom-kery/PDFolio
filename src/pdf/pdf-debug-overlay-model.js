import { PAGE_ANSWER_REGION_CONTRACT_VERSION } from '../analysis/page-answer-regions.js';
import { KEYWORD_CANDIDATE_CONTRACT_VERSION } from '../analysis/page-keyword-candidates.js';
import { TEXT_COORDINATE_CONTRACT_VERSION } from '../analysis/page-text-coordinates.js';
import {
  createViewportGeometry,
  projectPdfRectToViewport,
} from './pdf-coordinate-space.js';

export const PDF_DEBUG_OVERLAY_MODEL_VERSION = 1;

function isFiniteRect(rect) {
  return (
    rect &&
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
    rect.width >= 0 &&
    rect.height >= 0
  );
}

function isPageRect(rect, pageNumber) {
  return isFiniteRect(rect) && rect.page === pageNumber;
}

function isMatchingKeywords(coordinates, keywords) {
  const sourceIndexes = new Set(
    coordinates.items.map((item) => item?.sourceIndex),
  );
  return (
    keywords === null ||
    (keywords?.contractVersion === KEYWORD_CANDIDATE_CONTRACT_VERSION &&
      keywords.documentRevision === coordinates.documentRevision &&
      keywords.pageNumber === coordinates.pageNumber &&
      Number.isSafeInteger(keywords.candidateCount) &&
      keywords.candidateCount >= 0 &&
      Array.isArray(keywords.candidates) &&
      keywords.candidateCount === keywords.candidates.length &&
      keywords.candidates.every(
        (candidate) =>
          ['solution-heading', 'answer-heading'].includes(candidate?.kind) &&
          Array.isArray(candidate.sourceIndexes) &&
          candidate.sourceIndexes.length > 0 &&
          candidate.sourceIndexes.every((sourceIndex) =>
            sourceIndexes.has(sourceIndex),
          ),
      ))
  );
}

function isMatchingRegions(coordinates, regions) {
  return (
    regions === null ||
    (regions?.contractVersion === PAGE_ANSWER_REGION_CONTRACT_VERSION &&
      regions.documentRevision === coordinates.documentRevision &&
      regions.pageNumber === coordinates.pageNumber &&
      regions.coordinateSpace === 'pdf-user-space' &&
      ['candidate-regions', 'uncertain', 'no-candidates'].includes(
        regions.outcome,
      ) &&
      Number.isSafeInteger(regions.regionCount) &&
      regions.regionCount >= 0 &&
      Array.isArray(regions.reasonCodes) &&
      Array.isArray(regions.regions) &&
      regions.regionCount === regions.regions.length &&
      regions.regions.every(
        (region) =>
          ['solution-region', 'answer-region'].includes(region?.kind) &&
          isPageRect(region.bounds, coordinates.pageNumber) &&
          Array.isArray(region.textRects) &&
          region.textRects.every((rect) =>
            isPageRect(rect, coordinates.pageNumber),
          ),
      ))
  );
}

function validateInput({
  coordinates,
  keywordCandidates,
  answerRegions,
  scale,
  canvasWidth,
  canvasHeight,
}) {
  if (
    coordinates?.contractVersion !== TEXT_COORDINATE_CONTRACT_VERSION ||
    coordinates.coordinateSpace !== 'pdf-user-space' ||
    !Number.isSafeInteger(coordinates.documentRevision) ||
    !Number.isSafeInteger(coordinates.pageNumber) ||
    !Array.isArray(coordinates.items) ||
    !coordinates.items.every(
      (item) =>
        Number.isSafeInteger(item?.sourceIndex) &&
        isPageRect(item, coordinates.pageNumber),
    ) ||
    !isMatchingKeywords(coordinates, keywordCandidates) ||
    !isMatchingRegions(coordinates, answerRegions) ||
    !Number.isFinite(scale) ||
    scale <= 0 ||
    !Number.isFinite(canvasWidth) ||
    canvasWidth <= 0 ||
    !Number.isFinite(canvasHeight) ||
    canvasHeight <= 0
  ) {
    return false;
  }
  const indexes = coordinates.items.map((item) => item.sourceIndex);
  return new Set(indexes).size === indexes.length;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function projectRect(viewport, rect, scaleX, scaleY) {
  const projected = projectPdfRectToViewport(viewport, rect);
  return {
    x: round(projected.x * scaleX),
    y: round(projected.y * scaleY),
    width: round(projected.width * scaleX),
    height: round(projected.height * scaleY),
  };
}

/** Build text-free CSS geometry for the opt-in developer overlay. */
export function createPdfDebugOverlayModel({
  coordinates,
  keywordCandidates = null,
  answerRegions = null,
  scale,
  canvasWidth,
  canvasHeight,
} = {}) {
  if (
    !validateInput({
      coordinates,
      keywordCandidates,
      answerRegions,
      scale,
      canvasWidth,
      canvasHeight,
    })
  ) {
    return { status: 'error', code: 'INVALID_DEBUG_OVERLAY_INPUT' };
  }

  let viewport;
  try {
    viewport = createViewportGeometry(coordinates.page, { scale });
  } catch {
    return { status: 'error', code: 'INVALID_DEBUG_OVERLAY_VIEWPORT' };
  }
  const scaleX = canvasWidth / viewport.width;
  const scaleY = canvasHeight / viewport.height;
  if (![scaleX, scaleY].every(Number.isFinite))
    return { status: 'error', code: 'INVALID_DEBUG_OVERLAY_VIEWPORT' };

  const itemBySourceIndex = new Map(
    coordinates.items.map((item) => [item.sourceIndex, item]),
  );
  const textItems = coordinates.items.map((item) => ({
    sourceIndex: item.sourceIndex,
    rect: projectRect(viewport, item, scaleX, scaleY),
  }));
  const keywordMarks = (keywordCandidates?.candidates ?? []).flatMap(
    (candidate, candidateIndex) =>
      candidate.sourceIndexes.flatMap((sourceIndex) => {
        const item = itemBySourceIndex.get(sourceIndex);
        return item
          ? [
              {
                candidateIndex,
                sourceIndex,
                kind: candidate.kind,
                rect: projectRect(viewport, item, scaleX, scaleY),
              },
            ]
          : [];
      }),
  );
  const regionBounds = (answerRegions?.regions ?? []).map(
    (region, regionIndex) => ({
      regionIndex,
      kind: region.kind,
      rect: projectRect(viewport, region.bounds, scaleX, scaleY),
    }),
  );
  const regionTextRects = (answerRegions?.regions ?? []).flatMap(
    (region, regionIndex) =>
      region.textRects.map((rect, rectIndex) => ({
        regionIndex,
        rectIndex,
        kind: region.kind,
        rect: projectRect(viewport, rect, scaleX, scaleY),
      })),
  );

  return {
    status: 'ready',
    model: {
      contractVersion: PDF_DEBUG_OVERLAY_MODEL_VERSION,
      documentRevision: coordinates.documentRevision,
      pageNumber: coordinates.pageNumber,
      coordinateSpace: 'viewport-css-px',
      pageRotation: viewport.rotation,
      scale,
      canvas: { width: round(canvasWidth), height: round(canvasHeight) },
      itemCount: textItems.length,
      keywordCount: keywordCandidates?.candidateCount ?? 0,
      regionOutcome: answerRegions?.outcome ?? 'not-available',
      regionCount: answerRegions?.regionCount ?? 0,
      reasonCodes: [...(answerRegions?.reasonCodes ?? [])],
      layers: { textItems, keywordMarks, regionBounds, regionTextRects },
    },
  };
}
