import { convertViewportPointToPdf } from '../pdf/pdf-coordinate-space.js';

export const MANUAL_REGION_SETUP_CONTRACT_VERSION = 1;
export const MANUAL_REGION_SOURCE = 'manual-page-single-v1';
export const MANUAL_REGION_KINDS = Object.freeze(['solution', 'answer']);
export const MINIMUM_REGION_DRAG_CSS_PX = 8;

const RIGHT_ANGLE_ROTATIONS = new Set([0, 90, 180, 270]);
const PAGE_EDGE_EPSILON = 0.000001;
let fallbackIdSequence = 0;

function clonePage(page) {
  return {
    viewBox: [...page.viewBox],
    userUnit: page.userUnit,
    rotation: page.rotation,
  };
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

function cloneRegion(region) {
  return { ...region, rect: cloneRect(region.rect) };
}

function cloneConfirmation(confirmation) {
  if (!confirmation) return null;
  return {
    question: {
      ...confirmation.question,
      pageRefs: [...confirmation.question.pageRefs],
      regionIds: [...confirmation.question.regionIds],
    },
    regions: confirmation.regions.map(cloneRegion),
  };
}

function cloneDraft(draft) {
  if (!draft) return null;
  return {
    pageNumber: draft.pageNumber,
    page: clonePage(draft.page),
    mode: draft.mode,
    rects: Object.fromEntries(
      MANUAL_REGION_KINDS.filter((kind) => draft.rects[kind]).map((kind) => [
        kind,
        cloneRect(draft.rects[kind]),
      ]),
    ),
  };
}

function isValidPage(page) {
  return (
    page &&
    Array.isArray(page.viewBox) &&
    page.viewBox.length === 4 &&
    page.viewBox.every(Number.isFinite) &&
    page.viewBox[2] > page.viewBox[0] &&
    page.viewBox[3] > page.viewBox[1] &&
    Number.isFinite(page.userUnit) &&
    page.userUnit > 0 &&
    RIGHT_ANGLE_ROTATIONS.has(page.rotation)
  );
}

function isValidDocumentContext(context) {
  return (
    context &&
    typeof context.documentId === 'string' &&
    context.documentId.length > 0 &&
    Number.isSafeInteger(context.documentRevision) &&
    context.documentRevision > 0
  );
}

function roundCoordinate(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function isRectInsidePage(rect, page) {
  const [xMin, yMin, xMax, yMax] = page.viewBox;
  return (
    rect.x >= xMin - PAGE_EDGE_EPSILON &&
    rect.y >= yMin - PAGE_EDGE_EPSILON &&
    rect.x + rect.width <= xMax + PAGE_EDGE_EPSILON &&
    rect.y + rect.height <= yMax + PAGE_EDGE_EPSILON
  );
}

function normalizeRect(rect, page) {
  if (
    !rect ||
    !isValidPage(page) ||
    rect.coordinateSpace !== 'pdf-user-space' ||
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  )
    return { status: 'error', code: 'INVALID_REGION_RECT' };

  const normalized = {
    coordinateSpace: 'pdf-user-space',
    x: roundCoordinate(rect.x),
    y: roundCoordinate(rect.y),
    width: roundCoordinate(rect.width),
    height: roundCoordinate(rect.height),
  };
  if (!isRectInsidePage(normalized, page))
    return { status: 'error', code: 'REGION_OUT_OF_PAGE' };
  return { status: 'ready', rect: normalized };
}

function overlaps(left, right) {
  const width =
    Math.min(left.x + left.width, right.x + right.width) -
    Math.max(left.x, right.x);
  const height =
    Math.min(left.y + left.height, right.y + right.height) -
    Math.max(left.y, right.y);
  return width > PAGE_EDGE_EPSILON && height > PAGE_EDGE_EPSILON;
}

export function validateManualRegionRects({ page, rects } = {}) {
  if (!isValidPage(page))
    return { status: 'error', code: 'INVALID_PAGE_GEOMETRY' };
  if (!rects || !rects.solution || !rects.answer)
    return { status: 'error', code: 'REGIONS_INCOMPLETE' };

  const normalized = {};
  for (const kind of MANUAL_REGION_KINDS) {
    const result = normalizeRect(rects[kind], page);
    if (result.status !== 'ready') return result;
    normalized[kind] = result.rect;
  }
  if (overlaps(normalized.solution, normalized.answer))
    return { status: 'error', code: 'REGIONS_OVERLAP' };
  return { status: 'ready', rects: normalized };
}

/** Convert a pointer drag in viewport CSS pixels to a bounded PDF user-space rect. */
export function createPdfRectFromViewportDrag({
  viewport,
  page,
  start,
  end,
  minimumSize = MINIMUM_REGION_DRAG_CSS_PX,
} = {}) {
  if (
    !viewport ||
    !isValidPage(page) ||
    !start ||
    !end ||
    ![start.x, start.y, end.x, end.y, minimumSize].every(Number.isFinite) ||
    minimumSize <= 0
  )
    return { status: 'error', code: 'INVALID_REGION_DRAG' };

  if (
    Math.abs(end.x - start.x) < minimumSize ||
    Math.abs(end.y - start.y) < minimumSize
  )
    return { status: 'error', code: 'REGION_TOO_SMALL' };

  let first;
  let second;
  try {
    first = convertViewportPointToPdf(viewport, start.x, start.y);
    second = convertViewportPointToPdf(viewport, end.x, end.y);
  } catch {
    return { status: 'error', code: 'INVALID_REGION_DRAG' };
  }
  const x = Math.min(first[0], second[0]);
  const y = Math.min(first[1], second[1]);
  return normalizeRect(
    {
      coordinateSpace: 'pdf-user-space',
      x,
      y,
      width: Math.max(first[0], second[0]) - x,
      height: Math.max(first[1], second[1]) - y,
    },
    page,
  );
}

function defaultCreateId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  fallbackIdSequence += 1;
  return `${prefix}-${Date.now()}-${fallbackIdSequence}`;
}

/** Own page-single manual Region drafts and confirmations for one open document. */
export function createManualRegionSetupStore({
  createId = defaultCreateId,
} = {}) {
  let documentContext = null;
  let draft = null;
  const confirmedByPage = new Map();

  const openDocument = (context) => {
    if (!isValidDocumentContext(context))
      return { status: 'error', code: 'INVALID_DOCUMENT_CONTEXT' };
    documentContext = { ...context };
    draft = null;
    confirmedByPage.clear();
    return { status: 'ready' };
  };

  const clearDocument = () => {
    documentContext = null;
    draft = null;
    confirmedByPage.clear();
  };

  const begin = ({ pageNumber, page } = {}) => {
    if (
      !documentContext ||
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 ||
      !isValidPage(page)
    )
      return { status: 'error', code: 'INVALID_SETUP_CONTEXT' };
    const existing = confirmedByPage.get(pageNumber);
    const existingRects = existing
      ? Object.fromEntries(
          existing.regions.map((region) => [region.kind, region.rect]),
        )
      : {};
    draft = {
      pageNumber,
      page: clonePage(page),
      mode: 'editing',
      rects: Object.fromEntries(
        MANUAL_REGION_KINDS.filter((kind) => existingRects[kind]).map(
          (kind) => [kind, cloneRect(existingRects[kind])],
        ),
      ),
    };
    return { status: 'editing', draft: cloneDraft(draft) };
  };

  const setRect = (kind, rect) => {
    if (!draft || draft.mode !== 'editing')
      return { status: 'error', code: 'SETUP_NOT_EDITABLE' };
    if (!MANUAL_REGION_KINDS.includes(kind))
      return { status: 'error', code: 'INVALID_REGION_KIND' };
    const normalized = normalizeRect(rect, draft.page);
    if (normalized.status !== 'ready') return normalized;
    draft.rects[kind] = normalized.rect;
    return { status: 'editing', draft: cloneDraft(draft) };
  };

  const preview = () => {
    if (!draft || draft.mode !== 'editing')
      return { status: 'error', code: 'SETUP_NOT_EDITABLE' };
    const result = validateManualRegionRects(draft);
    if (result.status !== 'ready') return result;
    draft.rects = result.rects;
    draft.mode = 'preview';
    return { status: 'preview', draft: cloneDraft(draft) };
  };

  const edit = () => {
    if (!draft || draft.mode !== 'preview')
      return { status: 'error', code: 'PREVIEW_NOT_ACTIVE' };
    draft.mode = 'editing';
    return { status: 'editing', draft: cloneDraft(draft) };
  };

  const confirm = () => {
    if (!draft || draft.mode !== 'preview')
      return { status: 'error', code: 'PREVIEW_REQUIRED' };
    const result = validateManualRegionRects(draft);
    if (result.status !== 'ready') return result;

    const questionId = createId('question');
    const solutionRegionId = createId('region');
    const answerRegionId = createId('region');
    if (
      ![questionId, solutionRegionId, answerRegionId].every(
        (id) => typeof id === 'string' && id.length > 0,
      ) ||
      new Set([questionId, solutionRegionId, answerRegionId]).size !== 3
    )
      return { status: 'error', code: 'INVALID_GENERATED_ID' };

    const regionIds = [solutionRegionId, answerRegionId];
    const question = {
      contractVersion: MANUAL_REGION_SETUP_CONTRACT_VERSION,
      questionId,
      documentId: documentContext.documentId,
      documentRevision: documentContext.documentRevision,
      sourceKind: MANUAL_REGION_SOURCE,
      pageRefs: [draft.pageNumber],
      regionIds,
      choiceCount: 4,
      setupStatus: 'confirmed',
    };
    const regions = MANUAL_REGION_KINDS.map((kind, index) => ({
      contractVersion: MANUAL_REGION_SETUP_CONTRACT_VERSION,
      regionId: regionIds[index],
      questionId,
      documentRevision: documentContext.documentRevision,
      pageNumber: draft.pageNumber,
      kind,
      coordinateSpace: 'pdf-user-space',
      rect: cloneRect(result.rects[kind]),
      source: 'manual',
      confirmation: 'confirmed',
    }));
    const confirmation = { question, regions };
    confirmedByPage.set(draft.pageNumber, confirmation);
    draft = null;
    return {
      status: 'confirmed',
      confirmation: cloneConfirmation(confirmation),
    };
  };

  const cancel = () => {
    const canceled = Boolean(draft);
    draft = null;
    return { status: canceled ? 'canceled' : 'idle' };
  };

  const leavePage = (pageNumber) => {
    const canceled = Boolean(draft && draft.pageNumber !== pageNumber);
    if (canceled) draft = null;
    return {
      status: canceled ? 'canceled' : 'ready',
      confirmation: cloneConfirmation(confirmedByPage.get(pageNumber)),
    };
  };

  return Object.freeze({
    openDocument,
    clearDocument,
    begin,
    setRect,
    preview,
    edit,
    confirm,
    cancel,
    leavePage,
    getDraft: () => cloneDraft(draft),
    getConfirmation: (pageNumber) =>
      cloneConfirmation(confirmedByPage.get(pageNumber)),
    getDocumentContext: () => (documentContext ? { ...documentContext } : null),
  });
}
