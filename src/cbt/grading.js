export const GRADE_CONTRACT_VERSION = 1;

const SUPPORTED_CHOICE_COUNTS = new Set([4, 5]);

function keyFor(questionId, documentRevision) {
  return `${documentRevision}:${questionId}`;
}

function isLockedSelection(selection) {
  return (
    selection &&
    typeof selection.questionId === 'string' &&
    selection.questionId.length > 0 &&
    Number.isSafeInteger(selection.documentRevision) &&
    selection.documentRevision > 0 &&
    SUPPORTED_CHOICE_COUNTS.has(selection.choiceCount) &&
    Number.isSafeInteger(selection.selectedChoice) &&
    selection.selectedChoice >= 1 &&
    selection.selectedChoice <= selection.choiceCount &&
    selection.selectionStatus === 'locked'
  );
}

function isAnswerContext(answer, selection) {
  return (
    answer &&
    typeof answer.questionId === 'string' &&
    answer.questionId === selection.questionId &&
    Number.isSafeInteger(answer.documentRevision) &&
    answer.documentRevision === selection.documentRevision &&
    typeof answer.status === 'string' &&
    Array.isArray(answer.reasonCodes)
  );
}

function cloneGrade(grade) {
  return {
    contractVersion: GRADE_CONTRACT_VERSION,
    questionId: grade.questionId,
    documentRevision: grade.documentRevision,
    selectedChoice: grade.selectedChoice,
    answerValue: grade.answerValue,
    answerStatus: grade.answerStatus,
    gradeStatus: grade.gradeStatus,
    reasonCodes: [...grade.reasonCodes],
  };
}

function ungradableGrade(selection, answer, reasonCodes) {
  return {
    questionId: selection.questionId,
    documentRevision: selection.documentRevision,
    selectedChoice: selection.selectedChoice,
    answerValue: null,
    answerStatus: answer?.status ?? 'unavailable',
    gradeStatus: 'ungradable',
    reasonCodes: [...reasonCodes],
  };
}

/** Keep Unit 3.6 grading in current-document memory only. */
export function createGradeStore() {
  const grades = new Map();

  const grade = ({ selection, answer, revealed = false } = {}) => {
    if (!isLockedSelection(selection))
      return { status: 'error', code: 'CHOICE_NOT_CONFIRMED' };
    if (!revealed) return { status: 'error', code: 'ANSWER_NOT_REVEALED' };

    const key = keyFor(selection.questionId, selection.documentRevision);
    const existing = grades.get(key);
    if (existing)
      return { status: 'already-graded', grade: cloneGrade(existing) };

    let nextGrade;
    if (!answer) {
      nextGrade = ungradableGrade(selection, null, ['ANSWER_NOT_READY']);
    } else if (!isAnswerContext(answer, selection)) {
      return { status: 'error', code: 'GRADE_CONTEXT_MISMATCH' };
    } else if (answer.status !== 'known') {
      nextGrade = ungradableGrade(selection, answer, answer.reasonCodes);
    } else if (
      !Number.isSafeInteger(answer.value) ||
      answer.value < 1 ||
      answer.value > selection.choiceCount
    ) {
      nextGrade = ungradableGrade(selection, answer, [
        'KNOWN_ANSWER_OUTSIDE_CHOICE_COUNT',
      ]);
    } else {
      nextGrade = {
        questionId: selection.questionId,
        documentRevision: selection.documentRevision,
        selectedChoice: selection.selectedChoice,
        answerValue: answer.value,
        answerStatus: 'known',
        gradeStatus:
          selection.selectedChoice === answer.value ? 'correct' : 'incorrect',
        reasonCodes: [],
      };
    }
    grades.set(key, nextGrade);
    return { status: 'graded', grade: cloneGrade(nextGrade) };
  };

  return Object.freeze({
    grade,
    getGrade({ questionId, documentRevision } = {}) {
      if (
        typeof questionId !== 'string' ||
        questionId.length === 0 ||
        !Number.isSafeInteger(documentRevision) ||
        documentRevision <= 0
      )
        return null;
      const grade = grades.get(keyFor(questionId, documentRevision));
      return grade ? cloneGrade(grade) : null;
    },
    clearQuestion({ questionId, documentRevision } = {}) {
      if (
        typeof questionId === 'string' &&
        questionId.length > 0 &&
        Number.isSafeInteger(documentRevision) &&
        documentRevision > 0
      )
        grades.delete(keyFor(questionId, documentRevision));
    },
    resetDocument() {
      grades.clear();
    },
  });
}
