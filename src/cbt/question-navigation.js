import {
  MANUAL_REGION_SETUP_CONTRACT_VERSION,
  MANUAL_REGION_SOURCE,
} from './manual-region-setup.js';
import {
  QUESTION_PAGE_LINK_CONTRACT_VERSION,
  QUESTION_PAGE_LINK_SOURCE,
} from './question-page-links.js';

export const QUESTION_NAVIGATION_CONTRACT_VERSION = 1;

function clonePageRef(pageRef) {
  return { pageNumber: pageRef.pageNumber, role: pageRef.role };
}

function cloneItem(item) {
  return {
    contractVersion: QUESTION_NAVIGATION_CONTRACT_VERSION,
    questionId: item.questionId,
    documentRevision: item.documentRevision,
    promptPageNumber: item.promptPageNumber,
    pageRefs: item.pageRefs.map(clonePageRef),
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
    Number.isSafeInteger(question.documentRevision) &&
    question.documentRevision > 0 &&
    Array.isArray(question.pageRefs) &&
    question.pageRefs.length === 1 &&
    Number.isSafeInteger(question.pageRefs[0]) &&
    question.pageRefs[0] > 0
  );
}

function pageRefsFor(question, link) {
  if (
    link?.contractVersion === QUESTION_PAGE_LINK_CONTRACT_VERSION &&
    link.sourceKind === QUESTION_PAGE_LINK_SOURCE &&
    link.linkStatus === 'confirmed' &&
    link.questionId === question.questionId &&
    link.documentRevision === question.documentRevision &&
    Array.isArray(link.pageRefs) &&
    link.pageRefs.length >= 3 &&
    link.pageRefs[0]?.pageNumber === question.pageRefs[0] &&
    link.pageRefs[0]?.role === 'prompt'
  )
    return link.pageRefs.map(clonePageRef);
  return [{ pageNumber: question.pageRefs[0], role: 'prompt' }];
}

/**
 * Keep Question order separate from PDF page order. The input sequence is the
 * user-confirmed session order and is never inferred from page or printed IDs.
 */
export function createQuestionNavigationStore() {
  let documentRevision = null;
  let items = [];
  let activeQuestionId = null;

  const getActiveIndex = () =>
    items.findIndex((item) => item.questionId === activeQuestionId);

  const getState = () => {
    const activeIndex = getActiveIndex();
    return {
      contractVersion: QUESTION_NAVIGATION_CONTRACT_VERSION,
      documentRevision,
      items: items.map(cloneItem),
      activeQuestion: activeIndex < 0 ? null : cloneItem(items[activeIndex]),
      activeIndex,
      canGoPrevious: activeIndex > 0,
      canGoNext: activeIndex >= 0 && activeIndex < items.length - 1,
    };
  };

  const sync = ({ revision, confirmations, getLink = () => null } = {}) => {
    if (!Number.isSafeInteger(revision) || revision < 1)
      return { status: 'error', code: 'INVALID_DOCUMENT_REVISION' };
    if (!Array.isArray(confirmations))
      return { status: 'error', code: 'INVALID_CONFIRMATIONS' };

    documentRevision = revision;
    const nextItems = [];
    const seenQuestionIds = new Set();
    for (const confirmation of confirmations) {
      const question = confirmation?.question;
      if (
        !isConfirmedPageSingleQuestion(question) ||
        question.documentRevision !== revision ||
        seenQuestionIds.has(question.questionId)
      )
        continue;
      seenQuestionIds.add(question.questionId);
      nextItems.push({
        questionId: question.questionId,
        documentRevision: question.documentRevision,
        promptPageNumber: question.pageRefs[0],
        pageRefs: pageRefsFor(question, getLink(question)),
      });
    }
    items = nextItems;
    if (!items.some((item) => item.questionId === activeQuestionId))
      activeQuestionId = null;
    return { status: 'ready', state: getState() };
  };

  const activateQuestion = (questionId) => {
    if (!items.some((item) => item.questionId === questionId))
      return { status: 'error', code: 'QUESTION_NOT_FOUND' };
    activeQuestionId = questionId;
    return { status: 'active', state: getState() };
  };

  const activateForPage = (pageNumber) => {
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1)
      return { status: 'error', code: 'INVALID_PAGE_NUMBER' };
    const matches = items.filter(
      (item) => item.promptPageNumber === pageNumber,
    );
    if (matches.length !== 1) {
      activeQuestionId = null;
      return {
        status: matches.length === 0 ? 'idle' : 'ambiguous',
        state: getState(),
      };
    }
    activeQuestionId = matches[0].questionId;
    return { status: 'active', state: getState() };
  };

  const move = (direction) => {
    if (!Number.isSafeInteger(direction) || ![-1, 1].includes(direction))
      return { status: 'error', code: 'INVALID_NAVIGATION_DIRECTION' };
    const activeIndex = getActiveIndex();
    if (activeIndex < 0) return { status: 'error', code: 'NO_ACTIVE_QUESTION' };
    const nextIndex = activeIndex + direction;
    if (nextIndex < 0 || nextIndex >= items.length)
      return { status: 'boundary', state: getState() };
    activeQuestionId = items[nextIndex].questionId;
    return { status: 'active', state: getState() };
  };

  return Object.freeze({
    sync,
    activateQuestion,
    activateForPage,
    move,
    getState,
    reset() {
      documentRevision = null;
      items = [];
      activeQuestionId = null;
    },
  });
}
