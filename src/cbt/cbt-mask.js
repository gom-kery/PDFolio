import {
  MANUAL_REGION_KINDS,
  MANUAL_REGION_SETUP_CONTRACT_VERSION,
  MANUAL_REGION_SOURCE,
  validateManualRegionRects,
} from './manual-region-setup.js';

export const CBT_MASK_CONTRACT_VERSION = 1;

function cloneRect(rect) {
  return {
    coordinateSpace: 'pdf-user-space',
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function isRenderedPage(rendered) {
  return (
    rendered &&
    Number.isSafeInteger(rendered.documentRevision) &&
    rendered.documentRevision > 0 &&
    Number.isSafeInteger(rendered.pageNumber) &&
    rendered.pageNumber > 0 &&
    rendered.page
  );
}

/**
 * Turn one confirmed Unit 4.1 Question into the only Mask input accepted by
 * Unit 3.1. Any missing or stale evidence deliberately remains blocked.
 */
export function getCbtMaskReadiness({ rendered, confirmation } = {}) {
  if (!isRenderedPage(rendered))
    return { status: 'blocked', code: 'RENDER_NOT_READY' };
  if (!confirmation) return { status: 'blocked', code: 'NO_CONFIRMED_SETUP' };

  const { question, regions } = confirmation;
  if (
    question?.contractVersion !== MANUAL_REGION_SETUP_CONTRACT_VERSION ||
    question.sourceKind !== MANUAL_REGION_SOURCE ||
    question.setupStatus !== 'confirmed' ||
    question.documentRevision !== rendered.documentRevision ||
    !Array.isArray(question.pageRefs) ||
    question.pageRefs.length !== 1 ||
    question.pageRefs[0] !== rendered.pageNumber ||
    !Array.isArray(question.regionIds) ||
    question.regionIds.length !== MANUAL_REGION_KINDS.length ||
    new Set(question.regionIds).size !== MANUAL_REGION_KINDS.length ||
    !Array.isArray(regions) ||
    regions.length !== MANUAL_REGION_KINDS.length
  )
    return { status: 'blocked', code: 'INVALID_CONFIRMED_SETUP' };

  const regionsByKind = new Map(
    regions.map((region) => [region?.kind, region]),
  );
  if (
    regionsByKind.size !== MANUAL_REGION_KINDS.length ||
    !MANUAL_REGION_KINDS.every((kind) => regionsByKind.has(kind))
  )
    return { status: 'blocked', code: 'INVALID_CONFIRMED_SETUP' };

  const orderedRegions = MANUAL_REGION_KINDS.map((kind) =>
    regionsByKind.get(kind),
  );
  if (
    !orderedRegions.every(
      (region) =>
        region.contractVersion === MANUAL_REGION_SETUP_CONTRACT_VERSION &&
        region.questionId === question.questionId &&
        question.regionIds.includes(region.regionId) &&
        region.documentRevision === rendered.documentRevision &&
        region.pageNumber === rendered.pageNumber &&
        region.coordinateSpace === 'pdf-user-space' &&
        region.source === 'manual' &&
        region.confirmation === 'confirmed',
    )
  )
    return { status: 'blocked', code: 'INVALID_CONFIRMED_SETUP' };

  const validation = validateManualRegionRects({
    page: rendered.page,
    rects: Object.fromEntries(
      orderedRegions.map((region) => [region.kind, region.rect]),
    ),
  });
  if (validation.status !== 'ready')
    return { status: 'blocked', code: 'INVALID_CONFIRMED_SETUP' };

  return {
    status: 'ready',
    mask: {
      contractVersion: CBT_MASK_CONTRACT_VERSION,
      questionId: question.questionId,
      documentRevision: rendered.documentRevision,
      pageNumber: rendered.pageNumber,
      coordinateSpace: 'pdf-user-space',
      regions: MANUAL_REGION_KINDS.map((kind) => ({
        kind,
        rect: cloneRect(validation.rects[kind]),
      })),
    },
  };
}
