export const CHOICE_SELECTION_CONTRACT_VERSION = 1;
export const SUPPORTED_CHOICE_COUNTS = Object.freeze([4, 5]);

function cloneSelection(selection) {
  return {
    contractVersion: CHOICE_SELECTION_CONTRACT_VERSION,
    questionId: selection.questionId,
    documentRevision: selection.documentRevision,
    choiceCount: selection.choiceCount,
    selectedChoice: selection.selectedChoice,
    selectionStatus: selection.selectionStatus,
  };
}

function isQuestionContext(question) {
  return (
    question &&
    typeof question.questionId === 'string' &&
    question.questionId.length > 0 &&
    Number.isSafeInteger(question.documentRevision) &&
    question.documentRevision > 0 &&
    SUPPORTED_CHOICE_COUNTS.includes(question.choiceCount)
  );
}

function keyFor(questionId, documentRevision) {
  return `${documentRevision}:${questionId}`;
}

/**
 * Keep Unit 3.3 answer choices and their one-way confirmation in memory only.
 * This intentionally owns no reveal, grading, PDF, or persistent-storage behavior.
 */
export function createChoiceSelectionStore() {
  const selections = new Map();

  const syncQuestion = (question) => {
    if (!isQuestionContext(question))
      return { status: 'error', code: 'INVALID_QUESTION_CONTEXT' };
    const key = keyFor(question.questionId, question.documentRevision);
    let selection = selections.get(key);
    if (!selection) {
      selection = {
        questionId: question.questionId,
        documentRevision: question.documentRevision,
        choiceCount: question.choiceCount,
        selectedChoice: null,
        selectionStatus: 'unselected',
      };
      selections.set(key, selection);
    }
    return { status: 'ready', selection: cloneSelection(selection) };
  };

  const configureChoiceCount = ({
    questionId,
    documentRevision,
    choiceCount,
  }) => {
    const selection = selections.get(keyFor(questionId, documentRevision));
    if (!selection) return { status: 'error', code: 'QUESTION_NOT_READY' };
    if (!SUPPORTED_CHOICE_COUNTS.includes(choiceCount))
      return { status: 'error', code: 'INVALID_CHOICE_COUNT' };
    if (selection.selectionStatus === 'locked')
      return { status: 'error', code: 'CHOICE_LOCKED' };
    if (selection.choiceCount !== choiceCount) {
      selection.choiceCount = choiceCount;
      selection.selectedChoice = null;
      selection.selectionStatus = 'unselected';
    }
    return { status: 'ready', selection: cloneSelection(selection) };
  };

  const selectChoice = ({ questionId, documentRevision, choiceNumber }) => {
    const selection = selections.get(keyFor(questionId, documentRevision));
    if (!selection) return { status: 'error', code: 'QUESTION_NOT_READY' };
    if (selection.selectionStatus === 'locked')
      return { status: 'error', code: 'CHOICE_LOCKED' };
    if (
      !Number.isSafeInteger(choiceNumber) ||
      choiceNumber < 1 ||
      choiceNumber > selection.choiceCount
    )
      return { status: 'error', code: 'INVALID_CHOICE_NUMBER' };
    selection.selectedChoice = choiceNumber;
    selection.selectionStatus = 'selected';
    return { status: 'ready', selection: cloneSelection(selection) };
  };

  const confirmChoice = ({ questionId, documentRevision }) => {
    const selection = selections.get(keyFor(questionId, documentRevision));
    if (!selection) return { status: 'error', code: 'QUESTION_NOT_READY' };
    if (selection.selectionStatus === 'locked')
      return { status: 'error', code: 'CHOICE_ALREADY_CONFIRMED' };
    if (selection.selectedChoice === null)
      return { status: 'error', code: 'CHOICE_NOT_SELECTED' };
    selection.selectionStatus = 'locked';
    return { status: 'confirmed', selection: cloneSelection(selection) };
  };

  const clearQuestion = ({ questionId, documentRevision }) =>
    selections.delete(keyFor(questionId, documentRevision));

  return Object.freeze({
    syncQuestion,
    configureChoiceCount,
    selectChoice,
    confirmChoice,
    clearQuestion,
    resetDocument() {
      selections.clear();
    },
    getSelection({ questionId, documentRevision }) {
      const selection = selections.get(keyFor(questionId, documentRevision));
      return selection ? cloneSelection(selection) : null;
    },
  });
}
