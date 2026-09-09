import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GRADE_CONTRACT_VERSION,
  createGradeStore,
} from '../src/cbt/grading.js';

const selection = Object.freeze({
  questionId: 'question-one',
  documentRevision: 7,
  choiceCount: 5,
  selectedChoice: 4,
  selectionStatus: 'locked',
});

const knownAnswer = Object.freeze({
  questionId: 'question-one',
  documentRevision: 7,
  status: 'known',
  value: 4,
  reasonCodes: [],
});

test('grades a revealed matching locked selection as correct or incorrect once', () => {
  const correctStore = createGradeStore();
  const correct = correctStore.grade({
    selection,
    answer: knownAnswer,
    revealed: true,
  });
  assert.equal(correct.status, 'graded');
  assert.deepEqual(correct.grade, {
    contractVersion: GRADE_CONTRACT_VERSION,
    questionId: 'question-one',
    documentRevision: 7,
    selectedChoice: 4,
    answerValue: 4,
    answerStatus: 'known',
    gradeStatus: 'correct',
    reasonCodes: [],
  });
  assert.equal(
    correctStore.grade({
      selection,
      answer: { ...knownAnswer, value: 3 },
      revealed: true,
    }).status,
    'already-graded',
  );

  const incorrectStore = createGradeStore();
  const incorrect = incorrectStore.grade({
    selection: { ...selection, selectedChoice: 3 },
    answer: knownAnswer,
    revealed: true,
  });
  assert.equal(incorrect.grade.gradeStatus, 'incorrect');
  assert.equal(incorrect.grade.answerValue, 4);
});

test('keeps unavailable or uncertain answers ungradable without calling them incorrect', () => {
  const unknownStore = createGradeStore();
  const unknown = unknownStore.grade({
    selection,
    answer: {
      ...knownAnswer,
      status: 'unknown',
      value: null,
      reasonCodes: ['ANSWER_VALUE_NOT_FOUND'],
    },
    revealed: true,
  });
  assert.equal(unknown.grade.gradeStatus, 'ungradable');
  assert.deepEqual(unknown.grade.reasonCodes, ['ANSWER_VALUE_NOT_FOUND']);

  const waitingStore = createGradeStore();
  const waiting = waitingStore.grade({ selection, revealed: true });
  assert.equal(waiting.grade.gradeStatus, 'ungradable');
  assert.deepEqual(waiting.grade.reasonCodes, ['ANSWER_NOT_READY']);

  const rangeStore = createGradeStore();
  const range = rangeStore.grade({
    selection: { ...selection, choiceCount: 4 },
    answer: { ...knownAnswer, value: 5 },
    revealed: true,
  });
  assert.equal(range.grade.gradeStatus, 'ungradable');
  assert.deepEqual(range.grade.reasonCodes, [
    'KNOWN_ANSWER_OUTSIDE_CHOICE_COUNT',
  ]);
});

test('rejects pre-reveal, stale and unlocked grading then clears session grades', () => {
  const store = createGradeStore();
  assert.equal(
    store.grade({ selection, answer: knownAnswer }).code,
    'ANSWER_NOT_REVEALED',
  );
  assert.equal(
    store.grade({
      selection: { ...selection, selectionStatus: 'selected' },
      answer: knownAnswer,
      revealed: true,
    }).code,
    'CHOICE_NOT_CONFIRMED',
  );
  assert.equal(
    store.grade({
      selection,
      answer: { ...knownAnswer, documentRevision: 8 },
      revealed: true,
    }).code,
    'GRADE_CONTEXT_MISMATCH',
  );
  store.grade({ selection, answer: knownAnswer, revealed: true });
  store.clearQuestion(selection);
  assert.equal(store.getGrade(selection), null);
  store.grade({ selection, answer: knownAnswer, revealed: true });
  store.resetDocument();
  assert.equal(store.getGrade(selection), null);
});
