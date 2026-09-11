import {
  MANUAL_REGION_SETUP_CONTRACT_VERSION,
  MANUAL_REGION_SOURCE,
  validateManualRegionRect,
} from './manual-region-setup.js';

export const QUESTION_PAGE_LINK_CONTRACT_VERSION = 1;
export const QUESTION_PAGE_LINK_SOURCE = 'manual-question-page-link-v1';
export const QUESTION_PAGE_ROLES = Object.freeze([
  'prompt',
  'solution',
  'answer',
]);

let fallbackIdSequence = 0;

function defaultCreateId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  fallbackIdSequence += 1;
  return `${prefix}-${Date.now()}-${fallbackIdSequence}`;
}

function cloneRect(rect) {
  return {
    coordinateSpace: 'pdf-user-space',
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function cloneLink(link) {
  return {
    contractVersion: link.contractVersion,
    linkId: link.linkId,
    questionId: link.questionId,
    documentId: link.documentId,
    documentRevision: link.documentRevision,
    sourceKind: link.sourceKind,
    linkStatus: link.linkStatus,
    pageRefs: link.pageRefs.map((pageRef) => ({ ...pageRef })),
    regionIds: [...link.regionIds],
    regions: link.regions.map((region) => ({
      ...region,
      rect: cloneRect(region.rect),
    })),
  };
}

function isConfirmedPageSingleQuestion(question) {
  return (
    question &&
    question.contractVersion === MANUAL_REGION_SETUP_CONTRACT_VERSION &&
    question.sourceKind === MANUAL_REGION_SOURCE &&
    question.setupStatus === 'confirmed' &&
    typeof question.questionId === 'string' &&
    question.questionId.length > 0 &&
    typeof question.documentId === 'string' &&
    question.documentId.length > 0 &&
    Number.isSafeInteger(question.documentRevision) &&
    question.documentRevision > 0 &&
    Array.isArray(question.pageRefs) &&
    question.pageRefs.length === 1 &&
    Number.isSafeInteger(question.pageRefs[0]) &&
    question.pageRefs[0] > 0
  );
}

function uniquePageRefs(question, pageRegions) {
  const refs = [{ pageNumber: question.pageRefs[0], role: 'prompt' }];
  for (const region of pageRegions) {
    const pageRef = { pageNumber: region.pageNumber, role: region.kind };
    if (
      !refs.some(
        (existing) =>
          existing.pageNumber === pageRef.pageNumber &&
          existing.role === pageRef.role,
      )
    )
      refs.push(pageRef);
  }
  return refs;
}

function validatePageRegions(pageRegions) {
  if (!Array.isArray(pageRegions) || pageRegions.length < 2)
    return { status: 'error', code: 'REGIONS_INCOMPLETE' };

  const kinds = new Set();
  const normalized = [];
  for (const region of pageRegions) {
    if (
      !region ||
      !['solution', 'answer'].includes(region.kind) ||
      !Number.isSafeInteger(region.pageNumber) ||
      region.pageNumber < 1
    )
      return { status: 'error', code: 'INVALID_LINK_REGION' };
    const rectResult = validateManualRegionRect({
      page: region.page,
      rect: region.rect,
    });
    if (rectResult.status !== 'ready') return rectResult;
    kinds.add(region.kind);
    normalized.push({
      kind: region.kind,
      pageNumber: region.pageNumber,
      rect: rectResult.rect,
    });
  }
  if (!kinds.has('solution') || !kinds.has('answer'))
    return { status: 'error', code: 'REGIONS_INCOMPLETE' };
  return { status: 'ready', pageRegions: normalized };
}

/**
 * Keep page-spanning manual links alongside, rather than inside, confirmed
 * page-single Questions. This leaves the existing CBT state authoritative
 * until a later Unit explicitly consumes multi-page links.
 */
export function createQuestionPageLinkStore({
  createId = defaultCreateId,
} = {}) {
  let documentContext = null;
  const linksByQuestion = new Map();

  const openDocument = ({ documentId, documentRevision } = {}) => {
    if (
      typeof documentId !== 'string' ||
      documentId.length === 0 ||
      !Number.isSafeInteger(documentRevision) ||
      documentRevision < 1
    )
      return { status: 'error', code: 'INVALID_DOCUMENT_CONTEXT' };
    documentContext = { documentId, documentRevision };
    linksByQuestion.clear();
    return { status: 'ready' };
  };

  const upsertLink = ({ question, pageRegions } = {}) => {
    if (!documentContext)
      return { status: 'error', code: 'DOCUMENT_NOT_READY' };
    if (!isConfirmedPageSingleQuestion(question))
      return { status: 'error', code: 'INVALID_SOURCE_QUESTION' };
    if (
      question.documentId !== documentContext.documentId ||
      question.documentRevision !== documentContext.documentRevision
    )
      return { status: 'error', code: 'STALE_SOURCE_QUESTION' };

    const regionsResult = validatePageRegions(pageRegions);
    if (regionsResult.status !== 'ready') return regionsResult;
    if (
      !regionsResult.pageRegions.some(
        (region) => region.pageNumber !== question.pageRefs[0],
      )
    )
      return { status: 'error', code: 'LINK_PAGE_NOT_DIFFERENT' };

    const existing = linksByQuestion.get(question.questionId);
    const regionIds = regionsResult.pageRegions.map(() => createId('region'));
    if (
      regionIds.some((id) => typeof id !== 'string' || id.length === 0) ||
      new Set(regionIds).size !== regionIds.length ||
      question.regionIds?.some((id) => regionIds.includes(id))
    )
      return { status: 'error', code: 'INVALID_GENERATED_ID' };

    const link = {
      contractVersion: QUESTION_PAGE_LINK_CONTRACT_VERSION,
      linkId: existing?.linkId || createId('question-page-link'),
      questionId: question.questionId,
      documentId: question.documentId,
      documentRevision: question.documentRevision,
      sourceKind: QUESTION_PAGE_LINK_SOURCE,
      linkStatus: 'confirmed',
      pageRefs: uniquePageRefs(question, regionsResult.pageRegions),
      regionIds,
      regions: regionsResult.pageRegions.map((region, index) => ({
        contractVersion: QUESTION_PAGE_LINK_CONTRACT_VERSION,
        regionId: regionIds[index],
        questionId: question.questionId,
        documentRevision: question.documentRevision,
        pageNumber: region.pageNumber,
        kind: region.kind,
        coordinateSpace: 'pdf-user-space',
        rect: cloneRect(region.rect),
        source: 'manual',
        confirmation: 'confirmed',
      })),
    };
    if (typeof link.linkId !== 'string' || link.linkId.length === 0)
      return { status: 'error', code: 'INVALID_GENERATED_ID' };
    linksByQuestion.set(question.questionId, link);
    return {
      status: existing ? 'updated' : 'linked',
      link: cloneLink(link),
    };
  };

  return Object.freeze({
    openDocument,
    clearDocument() {
      documentContext = null;
      linksByQuestion.clear();
    },
    upsertLink,
    unlink({ questionId, documentRevision } = {}) {
      if (
        typeof questionId !== 'string' ||
        questionId.length === 0 ||
        !Number.isSafeInteger(documentRevision) ||
        documentRevision < 1
      )
        return { status: 'error', code: 'INVALID_LINK_CONTEXT' };
      const link = linksByQuestion.get(questionId);
      if (!link || link.documentRevision !== documentRevision)
        return { status: 'error', code: 'LINK_NOT_FOUND' };
      linksByQuestion.delete(questionId);
      return { status: 'unlinked', link: cloneLink(link) };
    },
    getLink({ questionId, documentRevision } = {}) {
      const link = linksByQuestion.get(questionId);
      return link && link.documentRevision === documentRevision
        ? cloneLink(link)
        : null;
    },
    getDocumentContext: () => (documentContext ? { ...documentContext } : null),
  });
}
