export const CBT_REVEAL_CONTRACT_VERSION = 1;

function keyFor(questionId, documentRevision) {
  return `${documentRevision}:${questionId}`;
}

function cloneReveal(reveal) {
  return {
    contractVersion: CBT_REVEAL_CONTRACT_VERSION,
    questionId: reveal.questionId,
    documentRevision: reveal.documentRevision,
    pageNumber: reveal.pageNumber,
  };
}

function isMaskContext(mask) {
  return (
    mask &&
    typeof mask.questionId === 'string' &&
    mask.questionId.length > 0 &&
    Number.isSafeInteger(mask.documentRevision) &&
    mask.documentRevision > 0 &&
    Number.isSafeInteger(mask.pageNumber) &&
    mask.pageNumber > 0
  );
}

function isLockedSelection(selection) {
  return (
    selection &&
    typeof selection.questionId === 'string' &&
    selection.questionId.length > 0 &&
    Number.isSafeInteger(selection.documentRevision) &&
    selection.documentRevision > 0 &&
    Number.isSafeInteger(selection.selectedChoice) &&
    selection.selectedChoice > 0 &&
    selection.selectionStatus === 'locked'
  );
}

/** Keep Unit 3.4 page-single mask reveals in session memory only. */
export function createCbtRevealStore() {
  const revealedByQuestion = new Map();

  const reveal = ({ mask, selection } = {}) => {
    if (!isMaskContext(mask)) return { status: 'error', code: 'INVALID_MASK' };
    if (!isLockedSelection(selection))
      return { status: 'error', code: 'CHOICE_NOT_CONFIRMED' };
    if (
      mask.questionId !== selection.questionId ||
      mask.documentRevision !== selection.documentRevision
    )
      return { status: 'error', code: 'REVEAL_CONTEXT_MISMATCH' };
    const key = keyFor(mask.questionId, mask.documentRevision);
    const existing = revealedByQuestion.get(key);
    if (existing)
      return { status: 'already-revealed', reveal: cloneReveal(existing) };
    const revealed = {
      questionId: mask.questionId,
      documentRevision: mask.documentRevision,
      pageNumber: mask.pageNumber,
    };
    revealedByQuestion.set(key, revealed);
    return { status: 'revealed', reveal: cloneReveal(revealed) };
  };

  const getReveal = ({ questionId, documentRevision, pageNumber } = {}) => {
    if (
      typeof questionId !== 'string' ||
      questionId.length === 0 ||
      !Number.isSafeInteger(documentRevision) ||
      documentRevision <= 0
    )
      return null;
    const reveal = revealedByQuestion.get(keyFor(questionId, documentRevision));
    if (!reveal) return null;
    if (
      Number.isSafeInteger(pageNumber) &&
      pageNumber > 0 &&
      reveal.pageNumber !== pageNumber
    )
      return null;
    return cloneReveal(reveal);
  };

  return Object.freeze({
    reveal,
    getReveal,
    clearQuestion({ questionId, documentRevision } = {}) {
      if (
        typeof questionId === 'string' &&
        questionId.length > 0 &&
        Number.isSafeInteger(documentRevision) &&
        documentRevision > 0
      )
        revealedByQuestion.delete(keyFor(questionId, documentRevision));
    },
    resetDocument() {
      revealedByQuestion.clear();
    },
  });
}
